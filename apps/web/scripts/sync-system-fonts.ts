/* eslint-disable no-console, @typescript-eslint/no-unsafe-assignment */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { getSystemAssetsProvider, getSystemFontsProvider } from "@/lib/server/r2";

loadEnvConfig(process.cwd(), false);

const execFileAsync = promisify(execFile);
const FONT_EXTENSIONS = new Set([".ttf", ".otf", ".woff", ".woff2"]);
const WIDTH_CLASS_NAMES = [
  "ultra-condensed",
  "extra-condensed",
  "condensed",
  "semi-condensed",
  "normal",
  "semi-expanded",
  "expanded",
  "extra-expanded",
  "ultra-expanded",
] as const;
type WidthClass = typeof WIDTH_CLASS_NAMES[number];
type FontStyle = "normal" | "italic" | "oblique";

type FontMetadata = {
  familyName: string;
  subfamilyName: string;
  postscriptName: string;
  versionName: string | null;
  os2WeightClass: number;
  weight: number;
  style: FontStyle;
  widthClass: WidthClass;
  axes: Record<string, { min: number; default: number; max: number }>;
};

type FontRecord = FontMetadata & {
  familySlug: string;
  familyName: string;
  metadataFamilyName: string;
  sourceFolder: string;
  sourceFile: string;
  absolutePath: string;
  format: "ttf" | "otf" | "woff" | "woff2";
  contentHash: string;
  byteSize: number;
  r2Key: string;
  legacyR2Key: string;
};

function argValue(name: string): string | undefined {
  return process.argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
}

const apply = process.argv.includes("--apply");
const skipUpload = process.argv.includes("--skip-upload");
const verify = process.argv.includes("--verify");
const pruneStale = process.argv.includes("--prune-stale");
const cleanupSource = process.argv.includes("--cleanup-source");
const onlyFamily = argValue("--family");
const systemFontsBucket = process.env.R2_SYSTEM_FONTS_BUCKET?.trim() || "neonix-system-fonts";

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function xmlName(xml: string, id: number): string | null {
  const pattern = new RegExp(
    `<namerecord\\s+[^>]*nameID="${id}"[^>]*>([\\s\\S]*?)</namerecord>`,
  );
  const match = xml.match(pattern);
  return match?.[1] ? decodeXml(match[1]) : null;
}

function xmlNumber(xml: string, tag: string): number | null {
  const match = xml.match(new RegExp(`<${tag}\\s+[^>]*value="([0-9]+(?:\\.[0-9]+)?)"`));
  return match?.[1] ? Number(match[1]) : null;
}

function xmlAttribute(attributes: string, name: string): string | null {
  return attributes.match(new RegExp(`${name}="([^"]+)"`))?.[1] ?? null;
}

function parseAxes(xml: string): Record<string, { min: number; default: number; max: number }> {
  const axes: Record<string, { min: number; default: number; max: number }> = {};
  const axisPattern = /<Axis\s+([^>]+?)\s*\/>/g;
  for (const match of xml.matchAll(axisPattern)) {
    const attributes = match[1] ?? "";
    const tag = xmlAttribute(attributes, "axisTag");
    const min = xmlAttribute(attributes, "minValue");
    const defaultValue = xmlAttribute(attributes, "defaultValue");
    const max = xmlAttribute(attributes, "maxValue");
    if (tag && min && defaultValue && max) {
      axes[tag] = { min: Number(min), default: Number(defaultValue), max: Number(max) };
    }
  }
  return axes;
}

function widthClass(value: number): WidthClass {
  return WIDTH_CLASS_NAMES[Math.max(0, Math.min(WIDTH_CLASS_NAMES.length - 1, value - 1))] ?? "normal";
}

function styleFromMetadata(subfamilyName: string, fsSelection: number | null): FontStyle {
  if ((fsSelection !== null && (fsSelection & 0x01) !== 0) || /italic/i.test(subfamilyName)) {
    return "italic";
  }
  if (/oblique/i.test(subfamilyName)) return "oblique";
  return "normal";
}

function cssWeightFromMetadata(subfamilyName: string, os2WeightClass: number): number {
  // OS/2 usWeightClass is the authoritative binary metadata. Some families
  // (for example Lora) encode Medium/SemiBold as a `Regular` subfamily while
  // the actual weight is stored correctly in OS/2. Reading the subfamily first
  // collapses those faces into weight 400 in the catalog.
  if (Number.isFinite(os2WeightClass) && os2WeightClass >= 1 && os2WeightClass <= 1000) {
    return Math.round(os2WeightClass);
  }
  const name = subfamilyName.toLowerCase();
  const named: Array<[RegExp, number]> = [
    [/hairline|thin/, 100],
    [/extra.?light|ultra.?light/, 200],
    [/light/, 300],
    [/regular|book|normal/, 400],
    [/medium/, 500],
    [/semi.?bold|demi.?bold/, 600],
    [/extra.?bold|ultra.?bold/, 800],
    [/bold/, 700],
    [/black|heavy/, 900],
  ];
  return named.find(([pattern]) => pattern.test(name))?.[1]
    ?? Math.max(1, Math.min(1000, Math.round(os2WeightClass / 100) * 100));
}

async function findTtx(): Promise<string> {
  const candidates = [
    process.env.TTX_PATH?.trim(),
    "ttx",
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Programs", "Python", "Python314", "Scripts", "ttx.exe")
      : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ["--version"]);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error("Unable to find fontTools ttx. Set TTX_PATH to ttx.exe.");
}

async function parseFontMetadata(filePath: string, ttx: string): Promise<FontMetadata> {
  const result = await execFileAsync(ttx, ["-q", "-t", "name", "-t", "OS/2", "-t", "fvar", "-o", "-", filePath], {
    maxBuffer: 4 * 1024 * 1024,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1",
    },
    windowsHide: true,
  });
  const xml = result.stdout;
  const familyName = xmlName(xml, 1) ?? path.basename(filePath, path.extname(filePath));
  const subfamilyName = xmlName(xml, 2) ?? "Regular";
  const postscriptName = xmlName(xml, 6) ?? path.basename(filePath, path.extname(filePath));
  const os2WeightClass = xmlNumber(xml, "usWeightClass") ?? 400;
  const width = xmlNumber(xml, "usWidthClass") ?? 5;
  const fsSelection = xml.match(/<fsSelection\\s+[^>]*value="([01 ]+)"/)?.[1]
    ?.replace(/ /g, "")
    ? Number.parseInt(xml.match(/<fsSelection\\s+[^>]*value="([01 ]+)"/)?.[1]?.replace(/ /g, "") ?? "0", 2)
    : null;

  return {
    familyName,
    subfamilyName,
    postscriptName,
    versionName: xmlName(xml, 5),
    os2WeightClass,
    weight: cssWeightFromMetadata(subfamilyName, os2WeightClass),
    style: styleFromMetadata(subfamilyName, fsSelection),
    widthClass: widthClass(width),
    axes: parseAxes(xml),
  };
}

async function listFontFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (FONT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) result.push(fullPath);
    }
  }
  await visit(root);
  return result.sort();
}

function canonicalFamily(folderName: string): string {
  // The local folder is the source of truth for family identity. Font
  // metadata may contain a named variable-font instance (for example
  // "IBM Plex Mono ExtraLight"), but that must never create another family.
  return folderName.replace(/[_-]+/g, " ").trim();
}

function versionFromFile(fileName: string): string {
  const base = path.basename(fileName, path.extname(fileName));
  return base
    .replace(/(?:Thin|ExtraLight|Light|Regular|Medium|SemiBold|Bold|ExtraBold|Black)(?:Italic)?$/i, "")
    .replace(/[-_]+$/, "")
    || "default";
}

function contentType(format: FontRecord["format"]): string {
  return `font/${format}`;
}

function sha256(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function discoverFonts(root: string, ttx: string): Promise<FontRecord[]> {
  const files = await listFontFiles(root);
  const records: FontRecord[] = [];
  for (const absolutePath of files) {
    const relative = path.relative(root, absolutePath);
    const parts = relative.split(path.sep);
    const sourceFolder = parts[0] ?? "unknown";
    const sourceFile = parts.at(-1) ?? relative;
    const metadata = await parseFontMetadata(absolutePath, ttx);
    const familyName = canonicalFamily(sourceFolder);
    const bytes = await readFile(absolutePath);
    const format = path.extname(sourceFile).slice(1).toLowerCase() as FontRecord["format"];
    records.push({
      ...metadata,
      familyName,
      metadataFamilyName: metadata.familyName,
      familySlug: slugify(familyName),
      sourceFolder,
      sourceFile,
      absolutePath,
      format,
      contentHash: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      byteSize: bytes.byteLength,
      // Keep the object key 1:1 with public/preview/font/<folder>/<file>.
      // Do not derive this from font metadata or invent a style-specific folder.
      r2Key: `${sourceFolder}/${sourceFile}`,
      legacyR2Key: `font/${slugify(familyName)}/${sourceFile}`,
    });
  }
  return records.filter((record) => !onlyFamily || record.familySlug === slugify(onlyFamily));
}

function defaultKeys(records: FontRecord[]): Set<string> {
  const keys = new Set<string>();
  for (const family of new Set(records.map((record) => record.familySlug))) {
    const candidate = records
      .filter((record) => record.familySlug === family && record.weight === 400 && record.style === "normal" && record.widthClass === "normal")
      .sort((a, b) => a.versionName?.localeCompare(b.versionName ?? "") ?? 0)[0];
    if (candidate) keys.add(candidate.r2Key);
  }
  return keys;
}

function faceKey(record: FontRecord): string {
  return `${versionFromFile(record.sourceFile)}:${record.postscriptName}`;
}

function assertUniqueCatalogIdentity(records: FontRecord[]): void {
  const identities = new Map<string, FontRecord[]>();
  for (const record of records) {
    const identity = [
      record.familySlug,
      faceKey(record),
      record.format,
    ].join("|");
    const group = identities.get(identity) ?? [];
    group.push(record);
    identities.set(identity, group);
  }
  const duplicates = [...identities.entries()].filter(([, group]) => group.length > 1);
  if (duplicates.length > 0) {
    const details = duplicates
      .map(([identity, group]) => `${identity}: ${group.map((record) => record.sourceFile).join(", ")}`)
      .join("\n");
    throw new Error(`Duplicate font catalog identities:\n${details}`);
  }
}

async function syncR2(records: FontRecord[]): Promise<void> {
  const provider = getSystemFontsProvider();
  let uploaded = 0;
  let skipped = 0;
  if (!skipUpload) {
    for (const record of records) {
      const existing = await provider.headObject(record.r2Key);
      if (existing) {
        if (existing.sizeBytes !== record.byteSize) {
          throw new Error(`R2 object exists with different size: ${record.r2Key}`);
        }
        if (verify) {
          const remoteBytes = await provider.getObject(record.r2Key);
          if (!remoteBytes || sha256(remoteBytes) !== record.contentHash) {
            throw new Error(`R2 hash verification failed: ${record.r2Key}`);
          }
        }
        skipped += 1;
        continue;
      }
      if (!apply) {
        uploaded += 1;
        continue;
      }
      await provider.putObject({
        key: record.r2Key,
        body: await readFile(record.absolutePath),
        contentType: contentType(record.format),
      });
      const uploadedObject = await provider.headObject(record.r2Key);
      if (!uploadedObject || uploadedObject.sizeBytes !== record.byteSize) {
        throw new Error(`R2 upload verification failed: ${record.r2Key}`);
      }
      if (verify) {
        const remoteBytes = await provider.getObject(record.r2Key);
        if (!remoteBytes || sha256(remoteBytes) !== record.contentHash) {
          throw new Error(`R2 hash verification failed: ${record.r2Key}`);
        }
      }
      uploaded += 1;
    }
  }
  if (!skipUpload) {
    console.log(`R2: ${uploaded} ${apply ? "uploaded" : "planned"}, ${skipped} already present`);
  }

  if (apply && pruneStale) {
    const expectedKeys = new Set(records.map((record) => record.r2Key));
    const existingKeys = await provider.listObjectKeys();
    const staleKeys = existingKeys.filter((key) => !expectedKeys.has(key));
    await provider.deleteObjects(staleKeys);
    const remainingKeys = await provider.listObjectKeys();
    const unexpectedKeys = remainingKeys.filter((key) => !expectedKeys.has(key));
    if (unexpectedKeys.length > 0) {
      throw new Error(`R2 stale-object verification failed: ${unexpectedKeys.slice(0, 5).join(", ")}`);
    }
    console.log(`R2 migration: ${staleKeys.length} stale objects deleted, ${remainingKeys.length} current objects remain`);
  }
}

async function syncDatabase(records: FontRecord[]): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase service-role configuration");
  if (!apply) return;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const defaults = defaultKeys(records);
  const familyRows = [...new Map(records.map((record) => [record.familySlug, record])).values()]
    .map((record) => ({
      slug: record.familySlug,
      family_name: record.familyName,
      license: "OFL-1.1",
      source: "system",
      enabled: true,
    }));
  const catalog = supabase.schema("system_catalog");
  const { data: families, error: familyError } = await catalog
    .from("font_families")
    .upsert(familyRows, { onConflict: "slug" })
    .select("id, slug");
  if (familyError) throw new Error(`font family upsert failed: ${familyError.message}`);

  const familyIds = new Map((families ?? []).map((row) => [row.slug as string, row.id as string]));
  const rows = records.map((record) => ({
    font_family_id: familyIds.get(record.familySlug),
    face_key: faceKey(record),
    version: versionFromFile(record.sourceFile),
    weight: record.weight,
    style: record.style,
    format: record.format,
    width_class: record.widthClass,
    storage_bucket: systemFontsBucket,
    r2_key: record.r2Key,
    public_url: null,
    content_hash: record.contentHash,
    byte_size: record.byteSize,
    is_default: defaults.has(record.r2Key),
    enabled: true,
    subfamily_name: record.subfamilyName,
    postscript_name: record.postscriptName,
    axes_json: record.axes,
    metadata_json: {
      source_folder: record.sourceFolder,
      source_file: record.sourceFile,
      family_name_from_font: record.metadataFamilyName,
      version_name: record.versionName,
      os2WeightClass: record.os2WeightClass,
      cssWeight: record.weight,
    },
  }));
  if (rows.some((row) => !row.font_family_id)) throw new Error("font family id resolution failed");
  if (pruneStale) {
    // The table has a unique constraint on (font_family_id, face_key, format).
    // Delete old-key rows before upserting the canonical local-folder keys;
    // otherwise a renamed object collides with its former catalog row.
    const expectedKeys = new Set(rows.map((row) => row.r2_key));
    const { data: existingRows, error: existingError } = await catalog
      .from("font_files")
      .select("id, r2_key");
    if (existingError) throw new Error(`old font row listing failed: ${existingError.message}`);
    const conflictingIds = (existingRows ?? [])
      .filter((row) => typeof row.r2_key === "string" && !expectedKeys.has(row.r2_key))
      .map((row) => row.id as string)
      .filter(Boolean);
    for (let offset = 0; offset < conflictingIds.length; offset += 100) {
      const chunk = conflictingIds.slice(offset, offset + 100);
      const { error } = await catalog.from("font_files").delete().in("id", chunk);
      if (error) throw new Error(`old font row deletion failed: ${error.message}`);
    }
    if (conflictingIds.length > 0) {
      console.log(`Supabase migration: ${conflictingIds.length} old-key font rows removed before upsert`);
    }
  }
  const { error: fileError } = await catalog
    .from("font_files")
    // r2_key is the stable object key for the bundled binary. The legacy
    // prefixed key is migrated before this upsert when moving catalog data.
    .upsert(rows, { onConflict: "r2_key" });
  if (fileError) throw new Error(`font file upsert failed: ${fileError.message}`);
  const verifiedByKey = new Map<string, {
    content_hash?: string;
    byte_size?: number;
    storage_bucket?: string;
  }>();
  for (let offset = 0; offset < records.length; offset += 100) {
    const keys = records.slice(offset, offset + 100).map((record) => record.r2Key);
    let verifiedRows: Array<Record<string, unknown>> | null = null;
    let verifyError: { message: string } | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await catalog
        .from("font_files")
        .select("r2_key, content_hash, byte_size, storage_bucket")
        .in("r2_key", keys);
      verifiedRows = (result.data ?? []) as Array<Record<string, unknown>>;
      verifyError = result.error;
      if (!verifyError) break;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
    if (verifyError) throw new Error(`font file verification failed: ${verifyError.message}`);
    for (const row of verifiedRows ?? []) {
      verifiedByKey.set(row.r2_key as string, row as {
        content_hash?: string;
        byte_size?: number;
        storage_bucket?: string;
      });
    }
  }
  for (const record of records) {
    const row = verifiedByKey.get(record.r2Key) as {
      content_hash?: string;
      byte_size?: number;
      storage_bucket?: string;
    } | undefined;
    if (!row || row.content_hash !== record.contentHash || Number(row.byte_size) !== record.byteSize || row.storage_bucket !== systemFontsBucket) {
      throw new Error(`font file metadata verification failed: ${record.r2Key}`);
    }
  }
  console.log(`Supabase: ${familyRows.length} families, ${rows.length} font files upserted`);
}

async function pruneStaleDatabase(records: FontRecord[]): Promise<void> {
  if (!apply || !pruneStale) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase service-role configuration");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const catalog = supabase.schema("system_catalog");
  const expectedKeys = new Set(records.map((record) => record.r2Key));
  const { data: existingRows, error: listError } = await catalog
    .from("font_files")
    .select("id, r2_key");
  if (listError) throw new Error(`stale font listing failed: ${listError.message}`);

  const staleIds = (existingRows ?? [])
    .filter((row) => typeof row.r2_key === "string" && !expectedKeys.has(row.r2_key))
    .map((row) => row.id as string)
    .filter(Boolean);
  for (let offset = 0; offset < staleIds.length; offset += 100) {
    const chunk = staleIds.slice(offset, offset + 100);
    const { error } = await catalog.from("font_files").delete().in("id", chunk);
    if (error) throw new Error(`stale font deletion failed: ${error.message}`);
  }

  const { count, error: verifyError } = await catalog
    .from("font_files")
    .select("id", { count: "exact", head: true });
  if (verifyError) throw new Error(`stale font deletion verification failed: ${verifyError.message}`);
  if (count !== records.length) {
    throw new Error(`stale font deletion verification expected ${records.length}, found ${count}`);
  }

  const expectedFamilySlugs = new Set(records.map((record) => record.familySlug));
  const { data: allFamilies, error: familyListError } = await catalog
    .from("font_families")
    .select("id, slug, source");
  if (familyListError) throw new Error(`stale family listing failed: ${familyListError.message}`);
  const { data: referencedRows, error: referencedError } = await catalog
    .from("font_files")
    .select("font_family_id");
  if (referencedError) throw new Error(`family reference listing failed: ${referencedError.message}`);
  const referencedIds = new Set((referencedRows ?? []).map((row) => row.font_family_id as string));
  const staleFamilyIds = (allFamilies ?? [])
    .filter((row) => row.source === "system" && !referencedIds.has(row.id as string) && !expectedFamilySlugs.has(row.slug as string))
    .map((row) => row.id as string)
    .filter(Boolean);
  for (let offset = 0; offset < staleFamilyIds.length; offset += 100) {
    const chunk = staleFamilyIds.slice(offset, offset + 100);
    const { error } = await catalog.from("font_families").delete().in("id", chunk);
    if (error) throw new Error(`stale family deletion failed: ${error.message}`);
  }

  const { data: remainingFamilies, error: remainingFamilyError } = await catalog
    .from("font_families")
    .select("slug")
    .eq("source", "system");
  if (remainingFamilyError) throw new Error(`stale family deletion verification failed: ${remainingFamilyError.message}`);
  const remainingFamilySlugs = new Set((remainingFamilies ?? []).map((row) => row.slug as string));
  if (remainingFamilySlugs.size !== expectedFamilySlugs.size || [...expectedFamilySlugs].some((slug) => !remainingFamilySlugs.has(slug))) {
    throw new Error(`stale family deletion verification expected ${expectedFamilySlugs.size} current families, found ${remainingFamilySlugs.size}`);
  }
  console.log(`Supabase migration: ${staleIds.length} stale font files deleted, ${staleFamilyIds.length} orphan families deleted, ${count} current files and ${remainingFamilySlugs.size} families remain`);
}

async function cleanupSourceFonts(records: FontRecord[]): Promise<void> {
  if (!apply || !cleanupSource) return;
  const oldSystemProvider = getSystemAssetsProvider();
  const newSystemFontsProvider = getSystemFontsProvider();
  let oldBucketDeleted = 0;
  let oldBucketMissing = 0;
  let legacyPrefixDeleted = 0;
  let legacyPrefixMissing = 0;
  for (const record of records) {
    const oldBucketObject = await oldSystemProvider.headObject(record.legacyR2Key);
    if (oldBucketObject) {
      await oldSystemProvider.deleteObject(record.legacyR2Key);
      oldBucketDeleted += 1;
    } else {
      oldBucketMissing += 1;
    }
    const legacyObject = await newSystemFontsProvider.headObject(record.legacyR2Key);
    if (legacyObject) {
      await newSystemFontsProvider.deleteObject(record.legacyR2Key);
      legacyPrefixDeleted += 1;
    } else {
      legacyPrefixMissing += 1;
    }
  }
  console.log(`Source cleanup: ${oldBucketDeleted} deleted from neonix-system-assets, ${oldBucketMissing} already absent`);
  console.log(`Legacy prefix cleanup: ${legacyPrefixDeleted} deleted from ${systemFontsBucket}, ${legacyPrefixMissing} already absent`);
}

async function main(): Promise<void> {
  const candidateRoots = [
    path.resolve(process.cwd(), "public", "preview", "font"),
    path.resolve(process.cwd(), "apps", "web", "public", "preview", "font"),
  ];
  let resolvedRoot: string | undefined;
  for (const candidate of candidateRoots) {
    if ((await stat(candidate).catch(() => null))?.isDirectory()) {
      resolvedRoot = candidate;
      break;
    }
  }
  if (!resolvedRoot) throw new Error(`Font directory not found: ${candidateRoots[0]}`);
  const ttx = await findTtx();
  const records = await discoverFonts(resolvedRoot, ttx);
  if (records.length === 0) throw new Error("No preview fonts found");
  assertUniqueCatalogIdentity(records);
  console.log(`${apply ? "APPLY" : "DRY-RUN"}: ${records.length} font files from ${resolvedRoot}`);
  for (const family of [...new Set(records.map((record) => record.familyName))]) {
    const familyRecords = records.filter((record) => record.familyName === family);
    console.log(`  ${family}: ${familyRecords.length} files`);
  }
  await syncR2(records);
  await syncDatabase(records);
  await pruneStaleDatabase(records);
  await cleanupSourceFonts(records);
  if (!apply) console.log("Dry-run complete. Add --apply to upload R2 objects and upsert Supabase metadata.");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
