import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["three"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "dgtzuqphqg23d.cloudfront.net" },
      { protocol: "https", hostname: "*.strava.com" },
    ],
  },
};

export default nextConfig;
