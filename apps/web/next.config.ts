import path from "node:path";
import type { NextConfig } from "next";

const nodeCryptoShim = path.join(process.cwd(), "lib/shims/node-crypto.ts");

const browserCryptoExternal =
  "var {createHash:()=>({update(){return this},digest(){return ''}}),createHmac:()=>{throw new Error('createHmac is server-only')},randomUUID:()=>(crypto.randomUUID()),timingSafeEqual:(a,b)=>a===b}";

const nextConfig: NextConfig = {
  // Legacy editor/Storybook lint debt is checked separately with `pnpm lint:web`.
  // Do not make a production build unavailable while that surface is frozen.
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: [
    "@motionvideo/render-contracts",
    "@motionvideo/motion-protocol",
    "@motionvideo/motion-runtime",
    "@motionvideo/motion-compiler",
    "@motionvideo/ai-planner",
    "@motionvideo/asset-registry",
    "@motionvideo/pixi-renderer",
    "@motionvideo/playback-engine",
  ],
  experimental: {
    turbo: {
      resolveAlias: {
        "node:crypto": "./lib/shims/node-crypto.ts",
      },
    },
  },
  webpack: (config, { isServer, webpack }) => {
    if (isServer) return config;

    const previous = config.externals;
    config.externals = [
      ...(Array.isArray(previous) ? previous : previous ? [previous] : []),
      (
        { request }: { request?: string },
        callback: (err?: Error | null, result?: string) => void,
      ) => {
        if (request === "node:crypto" || request === "crypto") {
          callback(null, browserCryptoExternal);
          return;
        }
        callback();
      },
    ];
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:crypto$/, nodeCryptoShim),
    );
    return config;
  },
};

export default nextConfig;
