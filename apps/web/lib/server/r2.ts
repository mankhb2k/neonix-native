import { R2StorageProvider } from "@motionvideo/motion-storage/r2";

type UserBucket = "assets" | "exports" | "system";

const providers = new Map<UserBucket, R2StorageProvider>();

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function bucketFor(kind: UserBucket): string {
  const specificName = {
    assets: "R2_USER_ASSETS_BUCKET",
    exports: "R2_USER_EXPORTS_BUCKET",
    system: "R2_SYSTEM_ASSETS_BUCKET",
  }[kind];
  const value = process.env[specificName]?.trim();
  // Keep the legacy fallback for the first user-assets integration.
  if (value) return value;
  if (kind === "assets") return requiredEnv("R2_BUCKET");
  throw new Error(`Missing ${specificName}`);
}

export function getR2Provider(kind: UserBucket): R2StorageProvider {
  const existing = providers.get(kind);
  if (existing) return existing;

  const provider = new R2StorageProvider({
    accountId: requiredEnv("R2_ACCOUNT_ID"),
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    bucket: bucketFor(kind),
    endpoint: process.env.R2_ENDPOINT?.trim() || undefined,
  });
  providers.set(kind, provider);
  return provider;
}

export function getUserAssetsProvider(): R2StorageProvider {
  return getR2Provider("assets");
}
