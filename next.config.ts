import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@anthropic-ai/bedrock-sdk",
    "@aws-sdk/client-bedrock-runtime",
    "@aws-sdk/credential-providers",
  ],
};

export default nextConfig;
