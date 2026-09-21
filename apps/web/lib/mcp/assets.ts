import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { assetKindForMime, MAX_ASSET_UPLOAD_BYTES, userAssetsBucketName } from "@/lib/server/asset-context";
import { getProjectAccess } from "@/lib/server/projects/repository";
import { getUserAssetsProvider } from "@/lib/server/r2";
import {
  getMcpSupabaseClient,
  resolveMcpWorkspace,
} from "./projects";
import type { McpPrincipal } from "./auth";

type JsonObject = Record<string, unknown>;

export class McpAssetError extends Error {
  constructor(message: string, readonly code = "ASSET_ERROR") {
    super(message);
    this.name = "McpAssetError";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127);
}

async function assertSafeImportUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new McpAssetError("source_url must be a valid URL", "INVALID_URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new McpAssetError("Only http and https asset URLs are supported", "INVALID_URL");
  }
  if (url.username || url.password || url.hostname === "localhost" || url.hostname.endsWith(".localhost")) {
    throw new McpAssetError("The asset URL is not allowed", "SSRF_BLOCKED");
  }
  if (isIP(url.hostname) === 6) {
    throw new McpAssetError("IPv6 asset URLs are not supported", "SSRF_BLOCKED");
  }
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateIpv4(entry.address))) {
    throw new McpAssetError("The asset URL resolves to a private or reserved address", "SSRF_BLOCKED");
  }
  return url;
}

async function fetchImportedBytes(rawUrl: string, maxBytes: number): Promise<{ bytes: Buffer; mimeType: string; filename: string }> {
  let current = rawUrl;
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const url = await assertSafeImportUrl(current);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: { accept: "image/*,video/*,audio/*" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new McpAssetError("Asset redirect has no location", "IMPORT_FAILED");
      current = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) throw new McpAssetError(`Asset URL returned HTTP ${response.status}`, "IMPORT_FAILED");
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) throw new McpAssetError("Imported asset exceeds the upload limit", "ASSET_TOO_LARGE");

    const reader = response.body?.getReader();
    if (!reader) throw new McpAssetError("Asset response has no body", "IMPORT_FAILED");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new McpAssetError("Imported asset exceeds the upload limit", "ASSET_TOO_LARGE");
      }
      chunks.push(part.value);
    }
    const mimeType = (response.headers.get("content-type") ?? "application/octet-stream").split(";", 1)[0].trim().toLowerCase();
    if (!/^(image|video|audio)\//.test(mimeType)) {
      throw new McpAssetError("Imported MIME type is not supported", "UNSUPPORTED_MIME");
    }
    const filename = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "imported-asset").slice(0, 200);
    return { bytes: Buffer.concat(chunks), mimeType, filename };
  }
  throw new McpAssetError("Too many redirects while importing asset", "IMPORT_FAILED");
}

function assetOutput(row: Record<string, unknown>) {
  return {
    assetId: String(row.id),
    referenceId: `asset-${String(row.id)}`,
    filename: row.original_filename,
    mimeType: row.mime_type,
    kind: row.kind,
    byteSize: row.byte_size,
    status: row.status,
    storageBucket: row.storage_bucket,
    createdAt: row.created_at,
    previewStatus: row.preview_status ?? null,
  };
}

async function audit(principal: McpPrincipal, workspaceId: string, action: string, targetId?: string, metadata: JsonObject = {}) {
  const { error } = await getMcpSupabaseClient(principal).from("audit_events").insert({
    workspace_id: workspaceId,
    actor_user_id: principal.userId,
    actor_client_id: principal.clientId,
    action,
    target_type: targetId ? "asset" : null,
    target_id: targetId ?? null,
    metadata_json: metadata,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[mcp.assets] audit event failed", error.message);
  }
}

async function maxUploadBytes(principal: McpPrincipal): Promise<number> {
  const client = getMcpSupabaseClient(principal);
  const { data } = await client.from("account_plans").select("max_upload_bytes").eq("id", principal.userId).maybeSingle();
  const configured = Number(data?.max_upload_bytes);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, MAX_ASSET_UPLOAD_BYTES) : MAX_ASSET_UPLOAD_BYTES;
}

export async function listAssets(principal: McpPrincipal, input: { workspaceId?: string; projectId?: string; publicRef?: string }) {
  const client = getMcpSupabaseClient(principal);
  let workspaceId = input.workspaceId;
  if (input.projectId || input.publicRef) {
    const access = await getProjectAccess(client, principal, { projectId: input.projectId, publicRef: input.publicRef });
    workspaceId = access.project.workspaceId;
  }
  const workspace = await resolveMcpWorkspace(principal, workspaceId, false);
  let query = client.from("assets")
    .select("id, original_filename, mime_type, kind, byte_size, status, storage_bucket, created_at, preview_status")
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .neq("kind", "font")
    .order("created_at", { ascending: false });
  if (input.projectId || input.publicRef) {
    const access = await getProjectAccess(client, principal, { projectId: input.projectId, publicRef: input.publicRef });
    const links = await client.from("project_assets").select("asset_id").eq("project_id", access.project.id);
    if (links.error) throw new McpAssetError(links.error.message, "DATABASE_ERROR");
    const ids = (links.data ?? []).map((link) => String(link.asset_id));
    query = ids.length > 0 ? query.in("id", ids) : query.eq("id", "00000000-0000-0000-0000-000000000000");
  }
  const result = await query;
  if (result.error) throw new McpAssetError(result.error.message, "DATABASE_ERROR");
  return { workspaceId: workspace.id, assets: (result.data ?? []).map((row) => assetOutput(row as unknown as Record<string, unknown>)) };
}

export async function requestAssetUpload(principal: McpPrincipal, input: {
  workspaceId?: string;
  filename: string;
  mimeType: string;
  byteSize: number;
}) {
  const workspace = await resolveMcpWorkspace(principal, input.workspaceId, true);
  const size = Number(input.byteSize);
  const mimeType = input.mimeType.trim().toLowerCase();
  if (!input.filename.trim() || !Number.isSafeInteger(size) || size <= 0) throw new McpAssetError("filename and byte_size are required", "INVALID_INPUT");
  if (!/^(image|video|audio)\//.test(mimeType)) throw new McpAssetError("Only image, video and audio assets are supported", "UNSUPPORTED_MIME");
  if (size > await maxUploadBytes(principal)) throw new McpAssetError("Asset exceeds the upload limit", "ASSET_TOO_LARGE");

  const client = getMcpSupabaseClient(principal);
  const assetId = randomUUID();
  const provider = getUserAssetsProvider();
  const storageKey = provider.createObjectKey(workspace.id, assetId, mimeType);
  const inserted = await client.from("assets").insert({
    id: assetId,
    workspace_id: workspace.id,
    r2_key: storageKey,
    content_hash: `pending:${assetId}`,
    mime_type: mimeType,
    byte_size: size,
    created_by: principal.userId,
    kind: assetKindForMime(mimeType),
    status: "uploading",
    storage_bucket: userAssetsBucketName(),
    original_filename: input.filename.trim().slice(0, 200),
    metadata_json: {},
    preview_status: "unsupported",
  }).select("id, original_filename, mime_type, kind, byte_size, status, storage_bucket, created_at, preview_status").single();
  if (inserted.error || !inserted.data) throw new McpAssetError(inserted.error?.message ?? "Unable to create asset", "DATABASE_ERROR");
  const session = await client.from("upload_sessions").insert({
    workspace_id: workspace.id,
    asset_id: assetId,
    created_by: principal.userId,
    status: "pending",
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    expected_byte_size: size,
    expected_mime_type: mimeType,
  });
  if (session.error) {
    await client.from("assets").delete().eq("id", assetId);
    throw new McpAssetError(session.error.message, "DATABASE_ERROR");
  }
  try {
    const signed = await provider.presignPut(storageKey, mimeType, 15 * 60);
    await audit(principal, workspace.id, "mcp.asset.upload.request", assetId, { byteSize: size, mimeType });
    return { asset: assetOutput(inserted.data), uploadUrl: signed.url, method: "PUT", headers: signed.headers, expiresAt: signed.expiresAt.toISOString() };
  } catch (error) {
    await client.from("upload_sessions").delete().eq("asset_id", assetId);
    await client.from("assets").delete().eq("id", assetId);
    throw new McpAssetError(errorMessage(error), "STORAGE_ERROR");
  }
}

export async function completeAssetUpload(principal: McpPrincipal, input: { assetId: string }) {
  const client = getMcpSupabaseClient(principal);
  const result = await client.from("assets").select("id, workspace_id, r2_key, mime_type, byte_size, status, original_filename, kind, storage_bucket, created_at, preview_status").eq("id", input.assetId).eq("created_by", principal.userId).is("deleted_at", null).maybeSingle();
  if (result.error) throw new McpAssetError(result.error.message, "DATABASE_ERROR");
  if (!result.data) throw new McpAssetError("Asset not found", "NOT_FOUND");
  if (result.data.status === "ready") return { asset: assetOutput(result.data), alreadyCompleted: true };
  const session = await client.from("upload_sessions")
    .select("status, expires_at")
    .eq("asset_id", input.assetId)
    .eq("created_by", principal.userId)
    .maybeSingle();
  if (session.error) throw new McpAssetError(session.error.message, "DATABASE_ERROR");
  if (!session.data || session.data.status !== "pending" || new Date(String(session.data.expires_at)).getTime() <= Date.now()) {
    throw new McpAssetError("Upload session is missing or expired", "UPLOAD_EXPIRED");
  }
  const head = await getUserAssetsProvider().headObject(String(result.data.r2_key));
  if (!head) throw new McpAssetError("The file has not finished uploading to R2", "UPLOAD_INCOMPLETE");
  if (head.sizeBytes !== Number(result.data.byte_size)) throw new McpAssetError("Uploaded file size does not match the declared size", "UPLOAD_MISMATCH");
  if (head.contentType && head.contentType !== result.data.mime_type) throw new McpAssetError("Uploaded MIME type does not match the declared type", "UPLOAD_MISMATCH");
  const updated = await client.from("assets").update({ status: "ready", content_hash: `r2:${head.sizeBytes}:${result.data.r2_key}` }).eq("id", input.assetId).eq("created_by", principal.userId).select("id, workspace_id, original_filename, mime_type, kind, byte_size, status, storage_bucket, created_at, preview_status").single();
  if (updated.error || !updated.data) throw new McpAssetError(updated.error?.message ?? "Unable to complete asset", "DATABASE_ERROR");
  await client.from("upload_sessions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("asset_id", input.assetId).eq("created_by", principal.userId);
  await audit(principal, String(result.data.workspace_id), "mcp.asset.upload.complete", input.assetId);
  return { asset: assetOutput(updated.data), alreadyCompleted: false };
}

export async function importAsset(principal: McpPrincipal, input: { workspaceId?: string; sourceUrl: string; filename?: string }) {
  const workspace = await resolveMcpWorkspace(principal, input.workspaceId, true);
  const bytes = await fetchImportedBytes(input.sourceUrl, await maxUploadBytes(principal));
  const client = getMcpSupabaseClient(principal);
  const assetId = randomUUID();
  const provider = getUserAssetsProvider();
  const storageKey = provider.createObjectKey(workspace.id, assetId, bytes.mimeType);
  const contentHash = createHash("sha256").update(bytes.bytes).digest("hex");
  await provider.putObject({ key: storageKey, body: bytes.bytes, contentType: bytes.mimeType });
  const inserted = await client.from("assets").insert({
    id: assetId,
    workspace_id: workspace.id,
    r2_key: storageKey,
    content_hash: contentHash,
    mime_type: bytes.mimeType,
    byte_size: bytes.bytes.byteLength,
    created_by: principal.userId,
    kind: assetKindForMime(bytes.mimeType),
    status: "ready",
    storage_bucket: userAssetsBucketName(),
    original_filename: (input.filename?.trim() || bytes.filename).slice(0, 200),
    metadata_json: { importedFrom: input.sourceUrl },
    preview_status: "unsupported",
  }).select("id, original_filename, mime_type, kind, byte_size, status, storage_bucket, created_at, preview_status").single();
  if (inserted.error || !inserted.data) {
    await provider.deleteObject(storageKey);
    throw new McpAssetError(inserted.error?.message ?? "Unable to register imported asset", "DATABASE_ERROR");
  }
  await audit(principal, workspace.id, "mcp.asset.import", assetId, { sourceUrl: input.sourceUrl, contentHash });
  return { asset: assetOutput(inserted.data) };
}

export async function attachAssetToProject(principal: McpPrincipal, input: { projectId?: string; publicRef?: string; assetId: string }) {
  const client = getMcpSupabaseClient(principal);
  const access = await getProjectAccess(client, principal, { projectId: input.projectId, publicRef: input.publicRef }, true);
  const asset = await client.from("assets").select("id, workspace_id, status").eq("id", input.assetId).eq("workspace_id", access.project.workspaceId).is("deleted_at", null).maybeSingle();
  if (asset.error) throw new McpAssetError(asset.error.message, "DATABASE_ERROR");
  if (!asset.data) throw new McpAssetError("Asset not found", "NOT_FOUND");
  if (asset.data.status !== "ready") throw new McpAssetError("Asset is not ready", "ASSET_NOT_READY");
  const linked = await client.from("project_assets").upsert({ project_id: access.project.id, asset_id: input.assetId, attached_by: principal.userId }, { onConflict: "project_id,asset_id", ignoreDuplicates: true });
  if (linked.error) throw new McpAssetError(linked.error.message, "DATABASE_ERROR");
  await audit(principal, access.project.workspaceId, "mcp.asset.attach", input.assetId, { projectId: access.project.id });
  return { projectId: access.project.id, assetId: input.assetId, attached: true };
}

export async function deleteAsset(principal: McpPrincipal, input: { workspaceId?: string; assetId: string; replaceReferences?: boolean }) {
  const workspace = await resolveMcpWorkspace(principal, input.workspaceId, true);
  const client = getMcpSupabaseClient(principal);
  const asset = await client.from("assets").select("id, workspace_id, r2_key, preview_key").eq("id", input.assetId).eq("workspace_id", workspace.id).is("deleted_at", null).maybeSingle();
  if (asset.error) throw new McpAssetError(asset.error.message, "DATABASE_ERROR");
  if (!asset.data) throw new McpAssetError("Asset not found", "NOT_FOUND");
  const links = await client.from("project_assets").select("project_id").eq("asset_id", input.assetId);
  if (links.error) throw new McpAssetError(links.error.message, "DATABASE_ERROR");
  if ((links.data ?? []).length > 0 && !input.replaceReferences) throw new McpAssetError("Asset is used by one or more projects", "ASSET_IN_USE");
  const variants = await client.from("asset_variants").select("r2_key").eq("asset_id", input.assetId);
  if (variants.error) throw new McpAssetError(variants.error.message, "DATABASE_ERROR");
  const keys = new Set([String(asset.data.r2_key), ...(asset.data.preview_key ? [String(asset.data.preview_key)] : []), ...(variants.data ?? []).map((row) => String(row.r2_key))]);
  await Promise.all([...keys].map((key) => getUserAssetsProvider().deleteObject(key)));
  const deleted = await client.rpc("delete_asset_with_system_fallback", { target_asset_id: input.assetId });
  if (deleted.error) throw new McpAssetError(deleted.error.message, "DATABASE_ERROR");
  await audit(principal, workspace.id, "mcp.asset.delete", input.assetId, { replaceReferences: input.replaceReferences === true });
  return { assetId: input.assetId, deleted: true, deletion: deleted.data as unknown };
}
