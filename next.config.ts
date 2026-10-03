import type { NextConfig } from "next"

const config: NextConfig = {
  // The ledger and the model run on the server; the compute role supplies credentials.
  serverExternalPackages: ["@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb", "@aws-sdk/client-bedrock-runtime", "@aws-sdk/client-s3"],
}

export default config
