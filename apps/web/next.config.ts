import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@gcc/shared"],
  outputFileTracingRoot: resolve(__dirname, "../.."),
};

export default nextConfig;
