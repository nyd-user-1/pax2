# Wan 2.2 TI2V-5B on one GPU box: the starter b-roll pack for /chat — eight 5-second 704x1280
# clips, campaign-neutral, nobody speaking. Each lands flat under studio/clip/ as wan-<slug>.mp4
# (the /api/studio/clip route's shape), with wan-manifest.json beside them.

import json
import os
import subprocess
import time

import torch
from diffusers import AutoencoderKLWan, WanPipeline
from diffusers.utils import export_to_video

BUCKET = os.environ["BUCKET"]
# A fleet splits the shot list: box i of n takes SHOTS[i::n]; the keys are disjoint, so the boxes
# share studio/clip/ without coordination.
SHARD = int(os.environ.get("SHARD", "0"))
SHARDS = int(os.environ.get("SHARDS", "1"))
MODEL = "Wan-AI/Wan2.2-TI2V-5B-Diffusers"
NEG = "low quality, blurry, distorted, warped, text, captions, watermark, logo, extra fingers, person talking to camera, speech"

SHOTS = [
    ("ballot-pen", "Close-up of a hand filling in an oval on a paper ballot with a pen, warm indoor light, shallow depth of field, vertical video"),
    ("voting-booths", "A row of voting booths with privacy curtains in a school gymnasium, morning light through high windows, no people, vertical video"),
    ("voted-stickers", "A roll of I Voted stickers on a folding table beside small American flags, soft focus background, vertical video"),
    ("town-hall", "A New England town hall exterior, white clapboard and a clock tower, golden hour, vertical video"),
    ("neighborhood", "Tree-lined neighborhood street with porch flags, early autumn, slow dolly forward, vertical video"),
    ("statehouse", "The Massachusetts State House golden dome against a blue sky, slow tilt upward, vertical video"),
    ("ballot-box", "A paper ballot sliding into the slot of a secure ballot box, close-up, clean even lighting, vertical video"),
    ("mail-ballots", "A stack of mail-in ballot envelopes on a wooden desk beside a pen, window light, vertical video"),
]

vae = AutoencoderKLWan.from_pretrained(MODEL, subfolder="vae", torch_dtype=torch.float32)
pipe = WanPipeline.from_pretrained(MODEL, vae=vae, torch_dtype=torch.bfloat16)
pipe.enable_model_cpu_offload()

made = []
for slug, prompt in SHOTS[SHARD::SHARDS]:
    t0 = time.time()
    frames = pipe(prompt=prompt, negative_prompt=NEG, height=1280, width=704, num_frames=121, guidance_scale=5.0, num_inference_steps=40).frames[0]
    out = f"/work/out/wan-{slug}.mp4"
    export_to_video(frames, out, fps=24)
    key = f"studio/clip/wan-{slug}.mp4"
    subprocess.run(["aws", "s3", "cp", "--only-show-errors", out, f"s3://{BUCKET}/{key}"], check=True)
    made.append({"slug": slug, "key": key, "prompt": prompt, "seconds": round(121 / 24, 2), "minutes": round((time.time() - t0) / 60, 1)})
    print(f"made wan-{slug}.mp4 in {made[-1]['minutes']} min", flush=True)

name = "wan-manifest.json" if SHARDS == 1 else f"wan-manifest-{SHARD}of{SHARDS}.json"
manifest = {"model": MODEL, "fps": 24, "frames": 121, "size": "704x1280", "steps": 40, "shard": SHARD, "shards": SHARDS, "made": made, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
with open(f"/work/out/{name}", "w") as f:
    json.dump(manifest, f, indent=2)
subprocess.run(["aws", "s3", "cp", "--only-show-errors", f"/work/out/{name}", f"s3://{BUCKET}/studio/clip/{name}"], check=True)
print(f"EXIT=0 all {len(made)} clips up", flush=True)
