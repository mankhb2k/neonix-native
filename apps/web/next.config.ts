import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Legacy editor/Storybook lint debt is checked separately with `pnpm lint:web`.
  // Do not make a production build unavailable while that surface is frozen.
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: [
    "@motionvideo/shared",
    "@motionvideo/motion-schema",
    "@motionvideo/motion-runtime",
    "@motionvideo/motion-compiler",
    "@motionvideo/template-library",
    "@motionvideo/ai-planner",
    "@motionvideo/motion-grammar",
    "@motionvideo/asset-registry",
    "@motionvideo/pixi-renderer",
    "@motionvideo/preview-kit",
    "@motionvideo/remotion-renderer",
  ],
};

export default nextConfig;
