import type { NextConfig } from "next"

const config: NextConfig = {
  devIndicators: false,
  // The inspector is development-only, and the guard inside it is not what
  // keeps it out of the build: aliasing the import to an empty stub is what
  // actually excludes it (verified in 44b — its strings survived into two
  // production chunks on a guard alone).
  turbopack: {
    resolveAlias:
      process.env.NODE_ENV === "development"
        ? {}
        : { "@/components/dev/inspector": "./src/components/dev/inspector.stub.tsx" },
  },
  async redirects() {
    return [
      { source: "/reviews", destination: "/evals", permanent: false },
      { source: "/campaign", destination: "/campaigns", permanent: false },
      { source: "/method", destination: "/scoring", permanent: false },
      { source: "/reference", destination: "/scoring?tab=research", permanent: false },
      { source: "/sources", destination: "/library", permanent: false },
      { source: "/break-out", destination: "/outliers", permanent: true },
    ]
  },
  // The ledger and the model run on the server; the compute role supplies credentials.
  serverExternalPackages: ["@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb", "@aws-sdk/client-bedrock-runtime", "@aws-sdk/client-s3"],
  // No next/image anywhere (every thumbnail is a plain img from YouTube's host), so sharp's 17 MB
  // of binaries has no caller; excluding it keeps the server bundle under Amplify's 220 MB cap.
  images: { unoptimized: true },
  outputFileTracingExcludes: { "*": ["node_modules/sharp/**", "node_modules/@img/**"] },
}

export default config
