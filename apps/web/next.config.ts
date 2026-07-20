import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@motionvideo/shared",
    "@motionvideo/motion-schema",
    "@motionvideo/template-library",
    "@motionvideo/ai-planner",
    "@motionvideo/motion-grammar",
    "@motionvideo/asset-registry",
  ],
};

export default nextConfig;
