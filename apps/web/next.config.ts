/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, no-param-reassign */

import path from "node:path";
import { loadEnvConfig } from "@next/env";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const currentDirectory = process.cwd();
// Loads apps/web's own .env* files into process.env - side effect only,
// the return value isn't otherwise needed.
loadEnvConfig(currentDirectory, process.env.NODE_ENV !== "production", undefined, true);

const nodeCryptoShim = path.join(process.cwd(), "lib/shims/node-crypto.ts");

const browserCryptoExternal =
  "var {createHash:()=>({update(){return this},digest(){return ''}}),createHmac:()=>{throw new Error('createHmac is server-only')},randomUUID:()=>(crypto.randomUUID()),timingSafeEqual:(a,b)=>a===b}";

const nextConfig: NextConfig = {
  // Allow isolated browser smoke runs to use a fresh build directory.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Keep production builds independent from the standalone lint command.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Same freeze as eslint: editor TS debt is `pnpm typecheck`, not Vercel.
    ignoreBuildErrors: true,
  },
  transpilePackages: [
    "@motionvideo/render-native",
    "@motionvideo/motion-protocol",
    "@motionvideo/motion-runtime",
    "@motionvideo/motion-compiler",
    "@motionvideo/asset-registry",
    "@motionvideo/canvaskit-preview",
    "@motionvideo/playback-engine",
    "@motionvideo/html-compiler",
  ],
  turbopack: {
    resolveAlias: {
      "node:crypto": "./lib/shims/node-crypto.ts",
    },
  },
  // Glama.ai's domain-ownership challenge must be served at the literal path
  // /.well-known/glama.json, but a route folder named "glama.json" isn't
  // resolved by typescript-eslint's project service. Serve it from a
  // normally-named route instead and rewrite the required path to it.
  rewrites() {
    return Promise.resolve([
      {
        source: "/.well-known/glama.json",
        destination: "/.well-known/glama-connector",
      },
    ]);
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

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
