"""PAX worker job 4: synthetic takes of the library scripts, until the partner's own videos arrive.

Each take = one script read by one Polly voice (the stand-in messenger), rendered as a
1080x1920 vertical video with burned-in captions timed from Polly's word marks.
Two production variants make the matrix testable: captions off, and a short cut.
Output: s3://pax-638175140432/videos/<take>.mp4 + takes/<take>.json (words, lines, durations).
"""
import json, os, re, subprocess
import boto3, requests

B = "pax-638175140432"
s3 = boto3.client("s3")
polly = boto3.client("polly", region_name="us-east-1")
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = "/opt/pax/takes"
os.makedirs(D, exist_ok=True)
FONT = f"{D}/Inter.ttf"
if not os.path.exists(FONT):
    r = requests.get("https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf", timeout=60)
    open(FONT, "wb").write(r.content)

lib = json.load(open(f"{REPO}/data/library.json"))
scripts = {s["id"]: s for s in lib["scripts"]}
VOICES = [("ruth", "Ruth", "#3b2a6b"), ("stephen", "Stephen", "#1f4e5f"), ("danielle", "Danielle", "#5a3b1f")]

TAKES = []
for sid in scripts:
    for vid, voice, bg in VOICES:
        TAKES.append({"id": f"{sid}-{vid}", "script": sid, "voice": voice, "bg": bg, "captions": True, "cut": False})
TAKES.append({"id": "coin-ruth-nocaps", "script": "coin", "voice": "Ruth", "bg": "#3b2a6b", "captions": False, "cut": False})
TAKES.append({"id": "listen-stephen-short", "script": "listen", "voice": "Stephen", "bg": "#1f4e5f", "captions": True, "cut": True})


def text_for(t):
    lines = [l for l in scripts[t["script"]]["text"].split("\n") if l.strip()]
    if t["cut"]:
        lines = [lines[0], lines[-2], lines[-1]] if len(lines) > 2 else lines
    return lines


def synth(t, lines):
    text = " ".join(lines)
    a = polly.synthesize_speech(Text=text, VoiceId=t["voice"], Engine="neural", OutputFormat="mp3")
    mp3 = f"{D}/{t['id']}.mp3"
    open(mp3, "wb").write(a["AudioStream"].read())
    m = polly.synthesize_speech(Text=text, VoiceId=t["voice"], Engine="neural", OutputFormat="json", SpeechMarkTypes=["word", "sentence"])
    marks = [json.loads(l) for l in m["AudioStream"].read().decode().splitlines() if l.strip()]
    return mp3, marks


def ass_time(ms):
    s = ms / 1000
    return f"{int(s // 3600)}:{int(s % 3600 // 60):02d}:{s % 60:05.2f}"


def captions(words, end_ms, path, voice, show):
    # Three to four words per caption, the way short-form captions run.
    # The name line and the ballot label ride in the same file (this ffmpeg has libass, not drawtext).
    groups, cur = [], []
    if not show:
        words = []
    for w in words:
        cur.append(w)
        if len(cur) >= 4 or re.search(r"[.!?…,—]$", w["value"]):
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)
    ev = []
    for i, g in enumerate(groups):
        start = g[0]["time"]
        stop = groups[i + 1][0]["time"] if i + 1 < len(groups) else end_ms
        txt = " ".join(w["value"] for w in g).upper()
        ev.append(f"Dialogue: 0,{ass_time(start)},{ass_time(stop)},Cap,,0,0,0,,{txt}")
    ev.append(f"Dialogue: 1,0:00:00.00,{ass_time(end_ms)},Name,,0,0,0,,{voice} · stand-in voice")
    ev.append(f"Dialogue: 1,0:00:00.00,{ass_time(end_ms)},Label,,0,0,0,,QUESTION 3")
    head = """[Script Info]
PlayResX: 1080
PlayResY: 1920
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV
Style: Cap,Inter,86,&H00FFFFFF,&H00000000,&H80000000,1,0,1,6,0,5,80,80,0
Style: Name,Inter,44,&H26FFFFFF,&H00000000,&H00000000,0,0,1,0,0,1,80,80,220
Style: Label,Inter,40,&H66FFFFFF,&H00000000,&H00000000,1,0,1,0,0,7,80,80,140
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    open(path, "w").write(head + "\n".join(ev) + "\n")


out = {}
for t in TAKES:
    lines = text_for(t)
    mp3, marks = synth(t, lines)
    words = [m for m in marks if m["type"] == "word"]
    dur = float(subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", mp3], capture_output=True, text=True).stdout.strip())
    end_ms = int(dur * 1000)
    ass = f"{D}/{t['id']}.ass"
    captions(words, end_ms, ass, t["voice"], t["captions"])
    vf = [f"subtitles={ass}:fontsdir={D}"]
    mp4 = f"{D}/{t['id']}.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"color=c={t['bg']}:s=1080x1920:r=30", "-i", mp3, "-vf", ",".join(vf), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-c:a", "aac", "-shortest", mp4], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1", "-i", mp4, "-frames:v", "1", "-vf", "scale=360:-1", f"{D}/{t['id']}.jpg"], check=True)
    # Script lines with the second each begins: the sentence marks, folded back onto the script's own lines.
    sent = [m for m in marks if m["type"] == "sentence"]
    line_starts, si = [], 0
    for l in lines:
        first = l.strip()[:20]
        hit = next((m for m in sent[si:] if m["value"].strip()[:20] == first), None)
        if hit is None:
            hit = sent[min(si, len(sent) - 1)]
        si = sent.index(hit) + 1
        line_starts.append({"t": round(hit["time"] / 1000, 2), "text": l.strip()})
    meta = {**t, "durationSec": round(dur, 2), "lines": line_starts, "words": [{"t": round(w["time"] / 1000, 2), "w": w["value"]} for w in words], "wordCount": len(words)}
    s3.upload_file(mp4, B, f"videos/{t['id']}.mp4", ExtraArgs={"ContentType": "video/mp4"})
    s3.upload_file(f"{D}/{t['id']}.jpg", B, f"videos/{t['id']}.jpg", ExtraArgs={"ContentType": "image/jpeg"})
    s3.put_object(Bucket=B, Key=f"takes/{t['id']}.json", Body=json.dumps(meta).encode())
    out[t["id"]] = {"sec": meta["durationSec"], "words": meta["wordCount"]}
    print(t["id"], meta["durationSec"], flush=True)
s3.put_object(Bucket=B, Key="manifest/takes.json", Body=json.dumps(out, indent=1).encode())
print("done", len(out), flush=True)
