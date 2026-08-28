import { Router, type Request, type Response, type NextFunction } from "express";
import type { StorageAsset } from "../types";
import { CreateUploadRequestSchema } from "../types";
import { AssetService, AssetServiceError } from "./service";

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

function sendServiceError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof AssetServiceError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  next(err);
}

export type CreateAssetApiRouterOptions = {
  service: AssetService;
};

/**
 * Express router mounting the closed-loop Asset API at `/assets`.
 */
export function createAssetApiRouter(options: CreateAssetApiRouterOptions): Router {
  const { service } = options;
  const router = Router();

  router.post(
    "/uploads",
    asyncHandler(async (req, res, next) => {
      try {
        const parsed = CreateUploadRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: {
              code: "invalid_request",
              message: parsed.error.issues[0]?.message ?? "Invalid request",
              issues: parsed.error.issues,
            },
          });
          return;
        }
        const result = await service.createUpload(parsed.data);
        res.status(201).json(result);
      } catch (err) {
        sendServiceError(err, res, next);
      }
    }),
  );

  router.put(
    "/uploads/:id/bytes",
    asyncHandler(async (req, res, next) => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const body = Buffer.concat(chunks);
        await service.putUploadBytes(req.params.id, body);
        res.status(204).end();
      } catch (err) {
        sendServiceError(err, res, next);
      }
    }),
  );

  router.post(
    "/uploads/:id/complete",
    asyncHandler(async (req, res, next) => {
      try {
        const result = await service.completeUpload(req.params.id);
        res.status(200).json(result);
      } catch (err) {
        sendServiceError(err, res, next);
      }
    }),
  );

  router.get(
    "/:id/download-url",
    asyncHandler(async (req, res, next) => {
      try {
        const result = await service.getDownloadUrl(req.params.id);
        res.status(200).json(result);
      } catch (err) {
        sendServiceError(err, res, next);
      }
    }),
  );

  router.get(
    "/objects/:token",
    asyncHandler(async (req, res, next) => {
      try {
        const object = await service.getObjectByToken(req.params.token);
        if (!object) {
          res.status(404).json({
            error: { code: "not_found", message: "Object not found" },
          });
          return;
        }
        res.status(200).type(object.contentType).send(object.body);
      } catch (err) {
        sendServiceError(err, res, next);
      }
    }),
  );

  router.post(
    "/validate",
    asyncHandler(async (req, res, next) => {
      try {
        const assets = (req.body?.assets ?? []) as StorageAsset[];
        if (!Array.isArray(assets)) {
          res.status(400).json({
            error: { code: "invalid_request", message: "assets must be an array" },
          });
          return;
        }
        const result = await service.validateAssets(assets);
        res.status(200).json(result);
      } catch (err) {
        sendServiceError(err, res, next);
      }
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res, next) => {
      try {
        await service.deleteAsset(req.params.id);
        res.status(204).end();
      } catch (err) {
        sendServiceError(err, res, next);
      }
    }),
  );

  return router;
}
