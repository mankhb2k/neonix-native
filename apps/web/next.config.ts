import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Legacy editor/Storybook lint debt is checked separately with `pnpm lint:web`.
  // Do not make a production build unavailable while that surface is frozen.
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: [
    "@motionvideo/render-contracts",
    "@motionvideo/motion-schema",
    "@motionvideo/motion-runtime",
    "@motionvideo/motion-compiler",
    "@motionvideo/ai-planner",
    "@motionvideo/asset-registry",
    "@motionvideo/pixi-renderer",
    "@motionvideo/remotion-renderer",
  ],
};

export default nextConfig;
