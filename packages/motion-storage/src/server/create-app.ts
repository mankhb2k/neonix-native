import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { MemoryAssetMetadataStore } from "./metadata";
import { MemoryStorageProvider } from "./providers/memory";
import { createR2StorageProviderFromEnv } from "./providers/r2";
import type { StorageProvider } from "./providers/types";
import { createAssetApiRouter } from "./express-router";
import { AssetService } from "./service";

export type CreateAssetApiAppOptions = {
  provider?: StorageProvider;
  publicBaseUrl?: string;
  apiToken?: string | null;
};

export function createAssetApiApp(options: CreateAssetApiAppOptions = {}): {
  app: Express;
  service: AssetService;
} {
  const publicBaseUrl = options.publicBaseUrl ?? "http://127.0.0.1:8787";
  const provider =
    options.provider ??
    new MemoryStorageProvider({ publicBaseUrl });
  const metadata = new MemoryAssetMetadataStore();
  const service = new AssetService({ provider, metadata, publicBaseUrl });

  const app = express();
  app.disable("x-powered-by");
  // JSON for control-plane routes; raw bytes handled in upload route via stream.
  app.use(express.json({ limit: "2mb" }));

  const apiToken = options.apiToken;
  if (apiToken) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const header = req.header("authorization") ?? "";
      const expected = `Bearer ${apiToken}`;
      if (header !== expected) {
        res.status(401).json({
          error: { code: "unauthorized", message: "Invalid or missing bearer token" },
        });
        return;
      }
      next();
    });
  }

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use("/assets", createAssetApiRouter({ service }));

  app.use(
    (
      err: unknown,
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      console.error(err);
      res.status(500).json({
        error: { code: "internal", message: "Internal server error" },
      });
    },
  );

  return { app, service };
}

export function createDefaultStorageProvider(
  env: NodeJS.ProcessEnv = process.env,
): StorageProvider {
  const mode = (env.MOTION_STORAGE_PROVIDER ?? "memory").toLowerCase();
  if (mode === "r2") {
    return createR2StorageProviderFromEnv(env);
  }
  return new MemoryStorageProvider({
    publicBaseUrl: env.MOTION_STORAGE_PUBLIC_URL ?? "http://127.0.0.1:8787",
  });
}
