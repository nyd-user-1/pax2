// Higgsfield smoke test: one Seedance 2.5 text-to-video generation through the official SDK
// (docs.higgsfield.ai/docs/how-to/sdk). Billable — run it on purpose, not from CI.
// The key lives in .env.local as HIGGSFIELD_API_KEY (key-id:key-secret); it is read at runtime
// and never printed.

process.loadEnvFile(new URL("../.env.local", import.meta.url).pathname)

const { config, higgsfield } = await import("@higgsfield/client/v2")

const credentials = process.env.HIGGSFIELD_API_KEY
if (!credentials || !credentials.includes(":")) {
  console.error("HIGGSFIELD_API_KEY is missing or not in key-id:key-secret format. Enter it in .env.local locally.")
  process.exit(1)
}
config({ credentials })

const started = Date.now()
console.log("Submitting bytedance/seedance-2.5/text-to-video (5 s, 720p, 16:9)…")
const result = await higgsfield.subscribe("bytedance/seedance-2.5/text-to-video", {
  input: {
    prompt: "A cinematic scene at sunset",
    duration: 5,
    resolution: "720p",
    aspect_ratio: "16:9",
    output_format: "mp4",
    generate_audio: true,
  },
  withPolling: true,
})

const seconds = Math.round((Date.now() - started) / 1000)
if (result?.status !== "completed") {
  console.error(`Not completed after ${seconds}s. Status: ${result?.status ?? "unknown"}.`)
  console.error(JSON.stringify(result, null, 2).slice(0, 2000))
  process.exit(1)
}
const url = result?.video?.url ?? result?.video ?? result?.videos?.[0]?.url ?? null
console.log(`Completed in ${seconds}s.`)
console.log("Video URL:", url ?? "(completed, but no video field — full result below)")
if (!url) console.log(JSON.stringify(result, null, 2).slice(0, 2000))
