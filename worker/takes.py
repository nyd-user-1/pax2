"""Hermes worker job 4: stand-in takes of the library scripts, until the partner's own videos arrive.

Each take = one script read by one Polly generative voice (the stand-in messenger) over Mixkit
stock footage, one clip per script line, rendered 1080x1920 with burned-in captions.
Each line is synthesized on its own, so every line's start time is exact; words inside a line
are timed by their share of the line's characters (generative voices return no word marks).
Two production variants make the matrix testable: captions off, and a short cut.
Usage: python3 takes.py <scripts.json>   (the library's scripts: [{id, text}])
Output: s3://hermes-638175140432/videos/<take>.mp4 + .jpg, takes/<take>.json (lines, words, duration).
"""
import json, os, re, subprocess, sys
import boto3, requests

B = "hermes-638175140432"
s3 = boto3.client("s3")
polly = boto3.client("polly", region_name="us-east-1")
D = "/opt/pax/takes"
C = "/opt/pax/takes/clips"
os.makedirs(C, exist_ok=True)
FONT = f"{D}/Inter.ttf"
if not os.path.exists(FONT):
    r = requests.get("https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf", timeout=60)
    open(FONT, "wb").write(r.content)

scripts = {s["id"]: s for s in json.load(open(sys.argv[1]))}
VOICES = [("ruth", "Ruth"), ("stephen", "Stephen"), ("danielle", "Danielle")]
GAP = 0.35  # seconds of silence between lines

# Mixkit (free, no attribution required), one clip per script line.
CLIPS = {
    "coin": [11074, 49264, 11191, 8764, 15997, 49263],
    "calm": [11125, 49265, 3428, 4000, 15997, 46901],
    "listen": [11125, 4350, 3574, 4000, 49265, 3428],
}

TAKES = []
for sid in scripts:
    for vid, voice in VOICES:
        TAKES.append({"id": f"{sid}-{vid}", "script": sid, "voice": voice, "captions": True, "cut": False})
TAKES.append({"id": "coin-ruth-nocaps", "script": "coin", "voice": "Ruth", "captions": False, "cut": False})
TAKES.append({"id": "listen-stephen-short", "script": "listen", "voice": "Stephen", "captions": True, "cut": True})


def run(*a):
    subprocess.run(list(a), check=True)


def seconds(path):
    return float(subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip())


def picked(t):
    lines = [l.strip() for l in scripts[t["script"]]["text"].split("\n") if l.strip()]
    idx = list(range(len(lines)))
    if t["cut"] and len(lines) > 2:
        idx = [0, len(lines) - 2, len(lines) - 1]
    return [(i, lines[i]) for i in idx]


def clip(cid):
    p = f"{C}/{cid}.mp4"
    if not os.path.exists(p):
        r = requests.get(f"https://assets.mixkit.co/videos/{cid}/{cid}-720.mp4", timeout=120, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        open(p, "wb").write(r.content)
    return p


def ass_time(s):
    return f"{int(s // 3600)}:{int(s % 3600 // 60):02d}:{s % 60:05.2f}"


def captions(words, end, path, voice, show):
    # Three to four words per caption, the way short-form captions run.
    groups, cur = [], []
    for w in words if show else []:
        cur.append(w)
        if len(cur) >= 4 or re.search(r"[.!?…,—]$", w["w"]):
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)
    ev = []
    for i, g in enumerate(groups):
        stop = groups[i + 1][0]["t"] if i + 1 < len(groups) else end
        stop = min(stop, g[-1]["end"] + 0.6)
        ev.append(f"Dialogue: 0,{ass_time(g[0]['t'])},{ass_time(stop)},Cap,,0,0,0,,{' '.join(w['w'] for w in g).upper()}")
    ev.append(f"Dialogue: 1,0:00:00.00,{ass_time(end)},Name,,0,0,0,,{voice} · stand-in voice")
    ev.append(f"Dialogue: 1,0:00:00.00,{ass_time(end)},Label,,0,0,0,,QUESTION 3")
    head = """[Script Info]
PlayResX: 1080
PlayResY: 1920
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV
Style: Cap,Inter,86,&H00FFFFFF,&H00000000,&H80000000,1,0,1,6,2,5,80,80,0
Style: Name,Inter,44,&H26FFFFFF,&H00000000,&H00000000,0,0,1,0,1,1,80,80,220
Style: Label,Inter,40,&H33FFFFFF,&H00000000,&H00000000,1,0,1,0,1,7,80,80,140
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    open(path, "w").write(head + "\n".join(ev) + "\n")


out = {}
only = set(sys.argv[2:])
for t in TAKES:
    if only and t["id"] not in only:
        continue
    tid = t["id"]
    parts, lines, words, segs, at = [], [], [], [], 0.0
    for n, (li, text) in enumerate(picked(t)):
        a = polly.synthesize_speech(Text=text, VoiceId=t["voice"], Engine="generative", OutputFormat="mp3", SampleRate="24000")
        mp3 = f"{D}/{tid}-{n}.mp3"
        open(mp3, "wb").write(a["AudioStream"].read())
        wav = f"{D}/{tid}-{n}.wav"
        run("ffmpeg", "-y", "-loglevel", "error", "-i", mp3, "-af", f"apad=pad_dur={GAP}", "-ar", "48000", "-ac", "2", wav)
        spoken = seconds(mp3)
        dur = seconds(wav)
        lines.append({"t": round(at, 2), "text": text})
        toks = text.split()
        total = sum(len(w) for w in toks) or 1
        c = 0
        for w in toks:
            words.append({"t": round(at + spoken * c / total, 2), "end": round(at + spoken * (c + len(w)) / total, 2), "w": w})
            c += len(w)
        seg = f"{D}/{tid}-{n}.mp4"
        cid = CLIPS[t["script"]][li % len(CLIPS[t["script"]])]
        vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,eq=brightness=-0.06:saturation=0.85,drawbox=color=black@0.38:t=fill,setsar=1"
        run("ffmpeg", "-y", "-loglevel", "error", "-stream_loop", "-1", "-i", clip(cid), "-t", f"{dur:.3f}", "-vf", vf, "-an", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", seg)
        parts.append((wav, seg))
        at += dur
    lst_a, lst_v = f"{D}/{tid}-a.txt", f"{D}/{tid}-v.txt"
    open(lst_a, "w").write("".join(f"file '{w}'\n" for w, _ in parts))
    open(lst_v, "w").write("".join(f"file '{v}'\n" for _, v in parts))
    audio, bg = f"{D}/{tid}.wav", f"{D}/{tid}-bg.mp4"
    run("ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst_a, "-c", "copy", audio)
    run("ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst_v, "-c", "copy", bg)
    end = seconds(audio)
    ass = f"{D}/{tid}.ass"
    captions(words, end, ass, t["voice"], t["captions"])
    mp4 = f"{D}/{tid}.mp4"
    run("ffmpeg", "-y", "-loglevel", "error", "-i", bg, "-i", audio, "-vf", f"subtitles={ass}:fontsdir={D}", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", mp4)
    run("ffmpeg", "-y", "-loglevel", "error", "-ss", "1.5", "-i", mp4, "-frames:v", "1", "-vf", "scale=480:-1", f"{D}/{tid}.jpg")
    meta = {**t, "durationSec": round(seconds(mp4), 2), "lines": lines, "words": [{"t": w["t"], "w": w["w"]} for w in words], "wordCount": len(words), "voiceEngine": "polly-generative", "footage": [f"mixkit:{CLIPS[t['script']][li % 6]}" for li, _ in picked(t)]}
    s3.upload_file(mp4, B, f"videos/{tid}.mp4", ExtraArgs={"ContentType": "video/mp4"})
    s3.upload_file(f"{D}/{tid}.jpg", B, f"videos/{tid}.jpg", ExtraArgs={"ContentType": "image/jpeg"})
    s3.put_object(Bucket=B, Key=f"takes/{tid}.json", Body=json.dumps(meta).encode())
    out[tid] = meta
    print(tid, meta["durationSec"], flush=True)
s3.put_object(Bucket=B, Key="jobs/out/takes.json", Body=json.dumps(sorted(out.values(), key=lambda m: m["id"]), indent=1, ensure_ascii=False).encode())
print("done", len(out), flush=True)
