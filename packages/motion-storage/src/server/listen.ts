import { createAssetApiApp, createDefaultStorageProvider } from "./create-app";
import { MemoryStorageProvider } from "./providers/memory";

const port = Number(process.env.PORT ?? process.env.MOTION_STORAGE_PORT ?? 8787);
const publicBaseUrl =
  process.env.MOTION_STORAGE_PUBLIC_URL ?? `http://127.0.0.1:${port}`;
const apiToken = process.env.MOTION_STORAGE_API_TOKEN ?? null;

const provider = createDefaultStorageProvider(process.env);
if (provider instanceof MemoryStorageProvider) {
  provider.setPublicBaseUrl(publicBaseUrl);
}

const { app, service } = createAssetApiApp({
  provider,
  publicBaseUrl,
  apiToken,
});
service.setPublicBaseUrl(publicBaseUrl);

app.listen(port, () => {
  console.log(
    `[motion-storage] listening on ${publicBaseUrl} (provider=${provider.kind})`,
  );
});
