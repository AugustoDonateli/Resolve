import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@resolve/ui"],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
