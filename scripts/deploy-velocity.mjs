// Deploys lambda/velocity to the hermes-velocity-poll function (creating it the first time). The
// YouTube key is read from .env.local into the function environment and never printed.
// Usage: (cd lambda/velocity && zip -q /tmp/hermes/velocity.zip index.mjs channels.json) && node scripts/deploy-velocity.mjs
import fs from "node:fs"
import { CreateFunctionCommand, GetFunctionCommand, LambdaClient, UpdateFunctionCodeCommand, UpdateFunctionConfigurationCommand, waitUntilFunctionActiveV2, waitUntilFunctionUpdatedV2 } from "@aws-sdk/client-lambda"
const lambda = new LambdaClient({ region: "us-east-1" })
const key = fs.readFileSync(".env.local", "utf8").match(/^YOUTUBE_API_KEY=(.*)$/m)[1].replace(/^"|"$/g, "").trim()
const FunctionName = "hermes-velocity-poll"
const ZipFile = fs.readFileSync("/tmp/hermes/velocity.zip")
const config = { Role: "arn:aws:iam::638175140432:role/hermes-velocity-poller", Handler: "index.handler", Runtime: "nodejs22.x", Timeout: 900, MemorySize: 1024, Environment: { Variables: { YOUTUBE_API_KEY: key, VELOCITY_BUCKET: "pax-638175140432" } }, Description: "hermes velocity poller: 15-minute YouTube Shorts readings, daily catalog, hourly stat card snapshot" }
let exists = true
try { await lambda.send(new GetFunctionCommand({ FunctionName })) } catch { exists = false }
if (!exists) {
  for (let i = 0; ; i++) {
    try { await lambda.send(new CreateFunctionCommand({ FunctionName, Code: { ZipFile }, ...config })); break }
    catch (e) { if (i < 6 && /role|assume/i.test(e.message)) { await new Promise((r) => setTimeout(r, 5000)); continue } throw e }
  }
  await waitUntilFunctionActiveV2({ client: lambda, maxWaitTime: 120 }, { FunctionName })
} else {
  await lambda.send(new UpdateFunctionCodeCommand({ FunctionName, ZipFile }))
  await waitUntilFunctionUpdatedV2({ client: lambda, maxWaitTime: 120 }, { FunctionName })
  await lambda.send(new UpdateFunctionConfigurationCommand({ FunctionName, ...config }))
  await waitUntilFunctionUpdatedV2({ client: lambda, maxWaitTime: 120 }, { FunctionName })
}
const f = await lambda.send(new GetFunctionCommand({ FunctionName }))
console.log(f.Configuration.FunctionArn, f.Configuration.State, f.Configuration.Runtime)
