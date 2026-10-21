"""Window MM-A, rung 0: mean-pooled CLIP ViT-B-32 (openai weights, open_clip) over the 16 frames embed.py
decoded for the VideoPrism base arm. Runs in the DLAMI's torch beside embed.py: it reads each
/work/clipq/<id>.npy (16 x 224 x 224 x 3 uint8, shorter side 224 and center-cropped), embeds the frames,
L2-normalizes each, means them, L2-normalizes the mean, writes the row and deletes the file. It stops when
embed.py has written /work/clipq/DONE and the queue is empty.

Env: OUT (default /work/out). Writes OUT/clip-frame-mean.jsonl ({id, vector}).
"""
import json, os, time

import numpy as np
import open_clip
import torch

OUT = os.environ.get("OUT", "/work/out")
Q = "/work/clipq"
os.makedirs(OUT, exist_ok=True)
model, _, _ = open_clip.create_model_and_transforms("ViT-B-32-quickgelu", pretrained="openai")  # the openai weights were trained with QuickGELU
model = model.cuda().eval().half()
MEAN = torch.tensor([0.48145466, 0.4578275, 0.40821073], device="cuda").view(1, 3, 1, 1)
STD = torch.tensor([0.26862954, 0.26130258, 0.27577711], device="cuda").view(1, 3, 1, 1)
f = open(f"{OUT}/clip-frame-mean.jsonl", "w")
n, t0 = 0, time.time()
print(time.strftime("%H:%M:%S"), "clip: ready", torch.cuda.get_device_name(0), flush=True)
while True:
    files = sorted(x for x in os.listdir(Q) if x.endswith(".npy") and not x.endswith(".tmp.npy"))
    if not files:
        if os.path.exists(f"{Q}/DONE"):
            break
        time.sleep(2)
        continue
    for name in files[:64]:
        vid = name[:-4]
        fr = torch.from_numpy(np.load(f"{Q}/{name}")).cuda().permute(0, 3, 1, 2).float() / 255.0
        with torch.no_grad():
            e = model.encode_image(((fr - MEAN) / STD).half()).float()
        e = e / e.norm(dim=1, keepdim=True)
        m = e.mean(0)
        m = (m / m.norm()).cpu().numpy()
        f.write(json.dumps({"id": vid, "vector": [round(float(a), 6) for a in m]}) + "\n")
        os.remove(f"{Q}/{name}")
        n += 1
    f.flush()
    if n % 500 < 64:
        print(time.strftime("%H:%M:%S"), f"clip: {n} embedded, {time.time() - t0:.0f}s", flush=True)
f.close()
print(time.strftime("%H:%M:%S"), f"clip: done, {n} embedded in {time.time() - t0:.0f}s", flush=True)
