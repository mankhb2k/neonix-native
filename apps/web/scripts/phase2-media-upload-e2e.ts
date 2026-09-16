/* eslint-disable no-console */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { handleQueueBatch } from "../../../infra/cloudflare/media-events-worker/src/index";
import { getUserAssetsProvider } from "../lib/server/r2";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = resolve(scriptDirectory, "..");
const repoRoot = resolve(appDirectory, "..", "..");
loadEnvConfig(appDirectory, process.env.NODE_ENV !== "production", undefined, true);

type JsonRecord = Record<string, unknown>;
type CookieJar = Map<string, string>;
type PollState = { asset: JsonRecord | null; job: JsonRecord | null };
type Variant = { variant_kind: string; r2_key: string; mime_type: string; byte_size: number };

function asJsonRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" ? value as JsonRecord : null;
}

function asVariant(value: unknown): Variant | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return typeof record.variant_kind === "string"
    && typeof record.r2_key === "string"
    && typeof record.mime_type === "string"
    && typeof record.byte_size === "number"
    ? {
        variant_kind: record.variant_kind,
        r2_key: record.r2_key,
        mime_type: record.mime_type,
        byte_size: record.byte_size,
      }
    : null;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function apiBaseUrl(): string {
  return (process.env.PHASE2_E2E_BASE_URL?.trim() || "http://127.0.0.1:3000").replace(/\/$/, "");
}

function cookiesFrom(response: Response, jar: CookieJar): void {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : []);
  for (const value of values) {
    const [pair] = value.split(";", 1);
    const separator = pair.indexOf("=");
    if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

function cookieHeader(jar: CookieJar): string {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function readJson(response: Response): Promise<JsonRecord> {
  const value = await response.json() as unknown;
  if (!value || typeof value !== "object") throw new Error(`Expected JSON, got HTTP ${response.status}`);
  return value as JsonRecord;
}

async function apiRequest(path: string, jar: CookieJar, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const cookie = cookieHeader(jar);
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(`${apiBaseUrl()}${path}`, { ...init, headers });
  cookiesFrom(response, jar);
  return response;
}

async function pollState<T extends SupabaseClient>(admin: T, assetId: string, timeoutMs: number): Promise<PollState> {
  const deadline = Date.now() + timeoutMs;
  let last: PollState | null = null;
  while (Date.now() < deadline) {
    const [{ data: asset, error: assetError }, { data: job, error: jobError }] = await Promise.all([
      admin.from("assets").select("id, status, media_status, r2_key, byte_size").eq("id", assetId).maybeSingle(),
      admin.from("media_jobs").select("id, status, attempt_count, last_error, last_error_code").eq("asset_id", assetId).maybeSingle(),
    ]);
    if (assetError) throw new Error(`asset poll failed: ${assetError.message}`);
    if (jobError) throw new Error(`media job poll failed: ${jobError.message}`);
    const assetRow = asJsonRecord(asset);
    const jobRow = asJsonRecord(job);
    last = { asset: assetRow, job: jobRow };
    if (typeof jobRow?.status === "string" && ["ready", "partial", "failed", "retryable"].includes(jobRow.status)) return last;
    await new Promise<void>((resolveWait) => { setTimeout(resolveWait, 1000); });
  }
  return last ?? { asset: null, job: null };
}

async function main(): Promise<void> {
  const sourcePath = join(repoRoot, "apps", "web", "public", "preview", "video", "demo-video.mp4");
  const source = await readFile(sourcePath);
  const jar: CookieJar = new Map();
  const baseUrl = apiBaseUrl();
  const startedAt = performance.now();

  const authResponse = await apiRequest("/api/dev/auth", jar, { method: "POST" });
  if (!authResponse.ok) throw new Error(`Demo auth failed: HTTP ${authResponse.status} ${await authResponse.text()}`);

  const createResponse = await apiRequest("/api/v1/assets", jar, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "phase2-demo-video.mp4", size: source.byteLength, mimeType: "video/mp4" }),
  });
  if (!createResponse.ok) throw new Error(`Asset create failed: HTTP ${createResponse.status} ${await createResponse.text()}`);
  const created = await readJson(createResponse);
  const assetId = typeof created.assetId === "string" ? created.assetId : "";
  const uploadUrl = typeof created.uploadUrl === "string" ? created.uploadUrl : "";
  const uploadHeaders = created.headers && typeof created.headers === "object" ? created.headers as Record<string, string> : {};
  if (!assetId || !uploadUrl) throw new Error("Asset create did not return assetId/uploadUrl");

  const uploadStartedAt = performance.now();
  const uploadResponse = await fetch(uploadUrl, { method: "PUT", headers: uploadHeaders, body: source });
  if (!uploadResponse.ok) throw new Error(`Direct R2 upload failed: HTTP ${uploadResponse.status} ${await uploadResponse.text()}`);

  const completeResponse = await apiRequest("/api/v1/assets/upload/complete", jar, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assetId }),
  });
  if (!completeResponse.ok) throw new Error(`Upload complete failed: HTTP ${completeResponse.status} ${await completeResponse.text()}`);
  const completed = await readJson(completeResponse);
  const asset = completed.asset && typeof completed.asset === "object" ? completed.asset as JsonRecord : null;
  const storageKey = typeof asset?.r2_key === "string" ? asset.r2_key : "";
  if (!storageKey) throw new Error("Upload complete did not return canonical R2 key");

  const provider = getUserAssetsProvider();
  const head = await provider.headObject(storageKey);
  if (!head) throw new Error(`R2 HEAD failed for ${storageKey}`);
  if (head.sizeBytes !== source.byteLength) throw new Error(`R2 size mismatch: ${head.sizeBytes} != ${source.byteLength}`);

  const event = {
    account: required("R2_ACCOUNT_ID"),
    action: "PutObject",
    bucket: process.env.R2_USER_ASSETS_BUCKET?.trim() || required("R2_BUCKET"),
    eventTime: new Date().toISOString(),
    object: { key: storageKey, size: head.sizeBytes, ...(head.eTag ? { eTag: head.eTag } : {}) },
  };
  const acked: string[] = [];
  const retried: string[] = [];
  const endpoint = `${baseUrl}/api/internal/media-events`;
  await handleQueueBatch({
    messages: [`phase2-${assetId}`, `phase2-duplicate-${assetId}`].map((messageId) => ({
      id: messageId,
      timestamp: new Date(),
      body: event,
      attempts: 1,
      ack: () => acked.push(messageId),
      retry: () => retried.push(messageId),
    })),
  }, {
    MEDIA_EVENT_HMAC_SECRET: required("MEDIA_EVENT_HMAC_SECRET"),
    MEDIA_EVENTS_ENDPOINT: endpoint,
  });

  const admin = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const state = await pollState(admin, assetId, 45_000);
  const { data: variants, error: variantsError } = await admin
    .from("asset_variants")
    .select("variant_kind, r2_key, mime_type, byte_size")
    .eq("asset_id", assetId)
    .order("variant_kind");
  if (variantsError) throw new Error(`variant poll failed: ${variantsError.message}`);
  const derivativeHeads: Array<{
    variantKind: string;
    expectedMimeType: string;
    expectedBytes: number;
    head: Awaited<ReturnType<ReturnType<typeof getUserAssetsProvider>["headObject"]>>;
  }> = [];
  const rawVariants: unknown[] = Array.isArray(variants) ? variants : [];
  for (const rawVariant of rawVariants) {
    const variant = asVariant(rawVariant);
    if (!variant) continue;
    derivativeHeads.push({
      variantKind: variant.variant_kind,
      expectedMimeType: variant.mime_type,
      expectedBytes: variant.byte_size,
      head: await provider.headObject(variant.r2_key),
    });
  }
  const derivativesVerified = derivativeHeads.length >= 2
    && derivativeHeads.every((item) => item.head?.sizeBytes === item.expectedBytes
      && item.head?.contentType === item.expectedMimeType);
  const report = {
    ok: retried.length === 0 && state.job?.status === "ready" && derivativesVerified,
    mode: "real R2 + real Supabase + local Worker handler + local Web API",
    fixture: sourcePath,
    baseUrl,
    assetId,
    storageKey,
    sourceBytes: source.byteLength,
    r2Head: { sizeBytes: head.sizeBytes, hasETag: Boolean(head.eTag), contentType: head.contentType },
    uploadMilliseconds: Math.round(performance.now() - uploadStartedAt),
    queueAdapter: { acked, retried, endpoint },
    finalState: state,
    derivatives: { rows: variants ?? [], heads: derivativeHeads, verified: derivativesVerified },
    elapsedMilliseconds: Math.round(performance.now() - startedAt),
    rendererReachable: process.env.EXPORT_RENDERER_URL ? process.env.EXPORT_RENDERER_URL : null,
    generatedAt: new Date().toISOString(),
  };
  const outputPath = join(repoRoot, "tmp", "phase2-media-upload-e2e.json");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ ...report, reportPath: outputPath }, null, 2));

  if (retried.length > 0) throw new Error("Phase 2 event was retried; see report for the Web API error");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
