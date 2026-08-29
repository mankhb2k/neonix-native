/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, no-param-reassign */

import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const currentDirectory = process.cwd();
const appEnv = loadEnvConfig(
  currentDirectory,
  process.env.NODE_ENV !== "production",
  undefined,
  true,
);
const publicSupabaseUrl = appEnv.combinedEnv.NEXT_PUBLIC_SUPABASE_URL;
const publicSupabasePublishableKey =
  appEnv.combinedEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const nodeCryptoShim = path.join(process.cwd(), "lib/shims/node-crypto.ts");

const browserCryptoExternal =
  "var {createHash:()=>({update(){return this},digest(){return ''}}),createHmac:()=>{throw new Error('createHmac is server-only')},randomUUID:()=>(crypto.randomUUID()),timingSafeEqual:(a,b)=>a===b}";

const nextConfig: NextConfig = {
  // Allow isolated browser smoke runs to use a fresh build directory.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Explicitly expose the Web app's public Supabase variables to the browser
  // bundle. The app reads them from apps/web/.env* in local development and
  // from the Web project's environment in Vercel.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: publicSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicSupabasePublishableKey,
  },
  // Keep production builds independent from the standalone lint command.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Same freeze as eslint: editor TS debt is `pnpm typecheck`, not Vercel.
    ignoreBuildErrors: true,
  },
  transpilePackages: [
    "@motionvideo/export-renderer",
    "@motionvideo/motion-protocol",
    "@motionvideo/motion-runtime",
    "@motionvideo/motion-compiler",
    "@motionvideo/asset-registry",
    "@motionvideo/preview-renderer",
    "@motionvideo/playback-engine",
  ],
  turbopack: {
    resolveAlias: {
      "node:crypto": "./lib/shims/node-crypto.ts",
    },
  },
  webpack: (config, { isServer, webpack }) => {
    // Explicitly define the public Supabase values for both dev and production
    // bundles when running from the nested Web app workspace.
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
