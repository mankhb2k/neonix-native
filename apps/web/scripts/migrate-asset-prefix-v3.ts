/* eslint-disable no-console */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { defaultObjectKey, derivativeObjectKey, getUserAssetsProvider } from "@/lib/server/r2";

loadEnvConfig(process.cwd(), false);

type AssetRow = {
  id: string;
  workspace_id: string;
  r2_key: string;
  mime_type: string;
  kind: string;
  preview_key: string | null;
};

type MigrationResult = {
  id: string;
  source?: string;
  target?: string;
  previewSource?: string;
  previewTarget?: string;
  action: "migrated" | "skipped" | "missing" | "failed";
  reason?: string;
};

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const deleteOld = args.has("--delete-old");
const onlyId = process.argv
  .find((arg) => arg.startsWith("--asset-id="))
  ?.slice("--asset-id=".length);

if (deleteOld && !apply) {
  throw new Error("--delete-old requires --apply");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const provider = getUserAssetsProvider();

async function migrateObject(sourceKey: string, targetKey: string): Promise<"copied" | "skipped"> {
  if (sourceKey === targetKey) return "skipped";

  const source = await provider.headObject(sourceKey);
  if (!source) throw new Error(`source object not found: ${sourceKey}`);

  const target = await provider.headObject(targetKey);
  if (target) {
    if (target.sizeBytes !== source.sizeBytes) {
      throw new Error(`target exists with different size: ${targetKey}`);
    }
    return "skipped";
  }

  if (!apply) return "copied";
  await provider.copyObject(sourceKey, targetKey);

  const copied = await provider.headObject(targetKey);
  if (!copied || copied.sizeBytes !== source.sizeBytes) {
    throw new Error(`copy verification failed: ${targetKey}`);
  }
  return "copied";
}

function legacyOriginalKey(asset: AssetRow, targetKey: string): string {
  const extension = targetKey.match(/\.([^./]+)$/)?.[1] ?? "bin";
  return `assets/asset.${asset.id}.${extension}`;
}

function legacyPreviewKey(assetId: string): string {
  return `assets/${assetId}/preview/poster.webp`;
}

async function main(): Promise<void> {
  let query = supabase
    .from("assets")
    .select("id, workspace_id, r2_key, mime_type, kind, preview_key")
    .order("created_at", { ascending: true });
  if (onlyId) query = query.eq("id", onlyId);

  const { data, error } = await query;
  if (error) throw new Error(`unable to read assets: ${error.message}`);
  const assets = (data ?? []) as AssetRow[];
  if (assets.length === 0) {
    console.log("No assets matched.");
    return;
  }

  console.log(`${apply ? "APPLY" : "DRY-RUN"}: ${assets.length} asset(s)`);
  const results: MigrationResult[] = [];

  for (const asset of assets) {
    if (asset.kind === "font") {
      results.push({ id: asset.id, source: asset.r2_key, target: asset.r2_key, action: "skipped", reason: "font keys are managed by the font namespace" });
      continue;
    }
    const targetKey = defaultObjectKey(asset.workspace_id, asset.id, asset.mime_type);
    const oldOriginalKey = legacyOriginalKey(asset, targetKey);
    const targetPreviewKey = asset.preview_key
      ? derivativeObjectKey(asset.workspace_id, asset.id, "poster", "poster.webp")
      : null;
    const result: MigrationResult = {
      id: asset.id,
      source: asset.r2_key,
      target: targetKey,
      previewSource: asset.preview_key ?? undefined,
      previewTarget: targetPreviewKey ?? undefined,
      action: "skipped",
    };

    try {
      const originalAction = await migrateObject(asset.r2_key, targetKey);
      let previewAction: "copied" | "skipped" = "skipped";
      if (asset.preview_key && targetPreviewKey) {
        previewAction = await migrateObject(asset.preview_key, targetPreviewKey);
      }

      const changed = originalAction === "copied" || previewAction === "copied";
      const metadataNeedsUpdate = asset.r2_key !== targetKey
        || (targetPreviewKey !== null && asset.preview_key !== targetPreviewKey);
      if (apply && metadataNeedsUpdate) {
        const update: { r2_key: string; preview_key?: string } = { r2_key: targetKey };
        if (targetPreviewKey) update.preview_key = targetPreviewKey;
        const { error: updateError } = await supabase
          .from("assets")
          .update(update)
          .eq("id", asset.id);
        if (updateError) throw new Error(`metadata update failed: ${updateError.message}`);
      }

      if (apply && deleteOld) {
        const originalKeysToDelete = new Set([oldOriginalKey, asset.r2_key]);
        for (const key of originalKeysToDelete) {
          if (key !== targetKey) await provider.deleteObject(key);
        }
        const oldPreviewKey = legacyPreviewKey(asset.id);
        const previewKeysToDelete = new Set([oldPreviewKey, asset.preview_key]);
        for (const key of previewKeysToDelete) {
          if (targetPreviewKey && key && key !== targetPreviewKey) {
            await provider.deleteObject(key);
          }
        }
      }
      result.action = changed ? "migrated" : "skipped";
    } catch (error) {
      result.action = error instanceof Error && error.message.includes("source object not found")
        ? "missing"
        : "failed";
      result.reason = error instanceof Error ? error.message : String(error);
    }
    results.push(result);
    console.log(JSON.stringify(result));
  }

  const counts = results.reduce<Record<string, number>>((acc, result) => {
    acc[result.action] = (acc[result.action] ?? 0) + 1;
    return acc;
  }, {});
  console.log("Summary:", counts);
  if (results.some((result) => result.action === "failed" || result.action === "missing")) {
    process.exitCode = 1;
  }
}

void main();
