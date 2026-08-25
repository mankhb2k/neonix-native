import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// The workspace keeps the local environment file at the repository root while
// this Next app lives in apps/web. Load that file before Next evaluates the
// client/server modules so Supabase variables are available in development.
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const currentDirectory = process.cwd();
const workspaceRoot = fs.existsSync(path.join(currentDirectory, ".env"))
  ? currentDirectory
  : path.resolve(currentDirectory, "../..");
const workspaceEnv = loadEnvConfig(
  workspaceRoot,
  process.env.NODE_ENV !== "production",
  undefined,
  true,
);
const publicSupabaseUrl = workspaceEnv.combinedEnv.NEXT_PUBLIC_SUPABASE_URL;
const publicSupabasePublishableKey =
  workspaceEnv.combinedEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const nodeCryptoShim = path.join(process.cwd(), "lib/shims/node-crypto.ts");

const browserCryptoExternal =
  "var {createHash:()=>({update(){return this},digest(){return ''}}),createHmac:()=>{throw new Error('createHmac is server-only')},randomUUID:()=>(crypto.randomUUID()),timingSafeEqual:(a,b)=>a===b}";

const nextConfig: NextConfig = {
  // Allow isolated browser smoke runs to use a fresh build directory.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Explicitly expose the root workspace's public Supabase variables to the
  // browser bundle. This is needed because the app package is nested under
  // apps/web while local development keeps .env at the repository root.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: publicSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicSupabasePublishableKey,
  },
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
    // Next's nested workspace setup can leave `process.env.*` in the browser
    // chunk instead of applying its normal public-env replacement. Define the
    // two public Supabase values explicitly for both dev and production builds.
    config.plugins.push(
      new webpack.DefinePlugin({
        "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(
          publicSupabaseUrl ?? "",
        ),
        "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
          publicSupabasePublishableKey ?? "",
        ),
      }),
    );

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
