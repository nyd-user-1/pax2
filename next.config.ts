import type { NextConfig } from "next"

const config: NextConfig = {
  devIndicators: false,
  async redirects() {
    return [
      { source: "/reviews", destination: "/evals", permanent: false },
      { source: "/campaign", destination: "/campaigns", permanent: false },
      { source: "/method", destination: "/scoring", permanent: false },
      { source: "/reference", destination: "/scoring?tab=research", permanent: false },
      { source: "/sources", destination: "/library", permanent: false },
    ]
  },
  // The ledger and the model run on the server; the compute role supplies credentials.
  serverExternalPackages: ["@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb", "@aws-sdk/client-bedrock-runtime", "@aws-sdk/client-s3"],
}

export default config
