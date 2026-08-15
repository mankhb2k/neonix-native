import type { WebpackOverrideFn } from "@remotion/bundler";

/**
 * Protocol/runtime pull `node:crypto` for hashing. The Remotion webpack
 * bundle runs in Chromium and cannot load that scheme.
 */
export const remotionWebpackOverride: WebpackOverrideFn = (config) => {
  const previous = config.externals;
  const externals = [
    ...(Array.isArray(previous) ? previous : previous ? [previous] : []),
    (
      { request }: { request?: string },
      callback: (err?: Error | null, result?: string) => void,
    ) => {
      if (request === "node:crypto" || request === "crypto") {
        callback(
          null,
          "var {createHash:()=>({update(){return this},digest(){return ''}})}",
        );
        return;
      }
      callback();
    },
  ];
  return { ...config, externals };
};
