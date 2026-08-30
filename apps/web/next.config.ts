import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@gcc/shared", "@gcc/ta"],
  outputFileTracingRoot: resolve(__dirname, "../.."),
};

export default nextConfig;
