// One-off data migration: copies the real `system_catalog` rows (font
// families, font files, system asset fallbacks) from the old Supabase
// Postgres project into this app's Neon database, preserving ids so
// `font_files.font_family_id` FKs and R2 keys/content hashes stay valid.
// Source data was pulled from Supabase via `mcp__supabase__execute_sql` and
// dumped to the JSON files read below - this script is not re-runnable
// against a live Supabase connection, it just replays that snapshot.
//
// Usage: DATABASE_URL=... pnpm exec tsx scripts/migrate-system-catalog.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db, pool } from "../src/db/client";
import { systemAssets, systemFontFamilies, systemFontFiles } from "../src/db/schema/system-catalog";

const SCRATCHPAD = String.raw`C:\Users\Admin\AppData\Local\Temp\claude\d--NextJS-neonix\6af19961-641a-4889-9c6e-807f6da1700e\scratchpad`;

interface FontFamilyRow {
  id: string;
  slug: string;
  family_name: string;
  license: string;
  enabled: boolean;
  source: string;
  created_at: string;
  updated_at: string;
}

interface FontFileRow {
  id: string;
  font_family_id: string;
  version: string;
  weight: number;
  style: string;
  format: string;
  storage_bucket: string;
  r2_key: string;
  public_url: string | null;
  content_hash: string;
  byte_size: number;
  is_default: boolean;
  enabled: boolean;
  created_at: string;
  subfamily_name: string | null;
  postscript_name: string | null;
  width_class: string;
  axes_json: Record<string, unknown>;
  metadata_json: Record<string, unknown>;
  face_key: string;
}

interface SystemAssetRow {
  id: string;
  parent_id: string | null;
  kind: string;
  variant_kind: string;
  r2_key: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  metadata_json: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

function loadJson<T>(filename: string): T {
  return JSON.parse(readFileSync(join(SCRATCHPAD, filename), "utf-8")) as T;
}

async function main() {
  const families = loadJson<FontFamilyRow[]>("system-font-families.json");
  const files = loadJson<FontFileRow[]>("system-font-files.json");
  const assets = loadJson<SystemAssetRow[]>("system-assets.json");

  console.log(`[migrate] loaded ${families.length} font families, ${files.length} font files, ${assets.length} system assets`);

  await db.insert(systemFontFamilies).values(
    families.map((f) => ({
      id: f.id,
      slug: f.slug,
      familyName: f.family_name,
      license: f.license,
      enabled: f.enabled,
      source: f.source,
      createdAt: new Date(f.created_at),
      updatedAt: new Date(f.updated_at),
    })),
  ).onConflictDoNothing();
  console.log(`[migrate] inserted ${families.length} font families`);

  const CHUNK = 100;
  for (let i = 0; i < files.length; i += CHUNK) {
    const chunk = files.slice(i, i + CHUNK);
    await db.insert(systemFontFiles).values(
      chunk.map((f) => ({
        id: f.id,
        fontFamilyId: f.font_family_id,
        version: f.version,
        weight: f.weight,
        style: f.style,
        format: f.format,
        storageBucket: f.storage_bucket,
        r2Key: f.r2_key,
        publicUrl: f.public_url,
        contentHash: f.content_hash,
        byteSize: f.byte_size,
        isDefault: f.is_default,
        enabled: f.enabled,
        createdAt: new Date(f.created_at),
        subfamilyName: f.subfamily_name,
        postscriptName: f.postscript_name,
        widthClass: f.width_class,
        axesJson: f.axes_json,
        metadataJson: f.metadata_json,
        faceKey: f.face_key,
      })),
    ).onConflictDoNothing();
    console.log(`[migrate] inserted font files ${i + 1}-${i + chunk.length} of ${files.length}`);
  }

  // system_assets has a self-referencing parent_id (poster -> video), so
  // insert parents (parent_id IS NULL) before children in the same table.
  const parents = assets.filter((a) => a.parent_id === null);
  const children = assets.filter((a) => a.parent_id !== null);
  const toRow = (a: SystemAssetRow) => ({
    id: a.id,
    parentId: a.parent_id,
    kind: a.kind,
    variantKind: a.variant_kind,
    r2Key: a.r2_key,
    mimeType: a.mime_type,
    byteSize: a.byte_size,
    width: a.width,
    height: a.height,
    durationMs: a.duration_ms,
    metadataJson: a.metadata_json,
    enabled: a.enabled,
    createdAt: new Date(a.created_at),
    updatedAt: new Date(a.updated_at),
  });
  if (parents.length > 0) {
    await db.insert(systemAssets).values(parents.map(toRow)).onConflictDoNothing();
  }
  if (children.length > 0) {
    await db.insert(systemAssets).values(children.map(toRow)).onConflictDoNothing();
  }
  console.log(`[migrate] inserted ${assets.length} system assets`);

  await pool.end();
}

void main();
