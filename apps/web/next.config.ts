import path from "node:path";
import type { NextConfig } from "next";

const nodeCryptoShim = path.join(process.cwd(), "lib/shims/node-crypto.ts");

const browserCryptoExternal =
  "var {createHash:()=>({update(){return this},digest(){return ''}}),createHmac:()=>{throw new Error('createHmac is server-only')},randomUUID:()=>(crypto.randomUUID()),timingSafeEqual:(a,b)=>a===b}";

const nextConfig: NextConfig = {
  // Allow isolated browser smoke runs to use a fresh build directory.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Legacy editor/Storybook lint debt is checked separately with `pnpm lint:web`.
  // Do not make a production build unavailable while that surface is frozen.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Same freeze as eslint: editor TS debt is `pnpm typecheck`, not Vercel.
    ignoreBuildErrors: true,
  },
  transpilePackages: [
    "@motionvideo/render-contracts",
    "@motionvideo/motion-protocol",
    "@motionvideo/motion-runtime",
    "@motionvideo/motion-compiler",
    "@motionvideo/ai-planner",
    "@motionvideo/asset-registry",
    "@motionvideo/preview-renderer",
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
    // Webpack's persistent filesystem cache can become unreadable on Windows
    // ("invalid stored block lengths"), leaving `next dev` stuck at Starting.
    // Keep the development server deterministic; production builds retain the
    // default cache behavior.
    if (process.env.NODE_ENV === "development") {
      config.cache = false;
    }

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
      new webpack.NormalModuleReplacementPlugin(
        /^node:crypto$/,
        nodeCryptoShim,
      ),
    );
    return config;
  },
};

export default nextConfig;
