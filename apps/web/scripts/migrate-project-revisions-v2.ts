/* eslint-disable no-console */

import { createHash } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { migrateMotionProtocolV2 } from "@motionvideo/motion-protocol";
import { MotionProtocolV2Schema, type MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

loadEnvConfig(process.cwd(), false);

type JsonRecord = Record<string, unknown>;

type ProjectRow = {
  id: string;
  title: string;
  current_revision_no: number;
  created_by: string;
};

type RevisionRow = {
  id: string;
  project_id: string;
  revision_no: number;
  document_json: unknown;
  created_by: string;
};

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const projectId = process.argv
  .find((arg) => arg.startsWith("--project-id="))
  ?.slice("--project-id=".length);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function requiredNumber(value: unknown, path: string): number {
  const result = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(result)) throw new Error(`${path} must be a finite number`);
  return result;
}

function optionalNumber(value: unknown, path: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return requiredNumber(value, path);
}

function optionalInteger(value: unknown, path: string): number | undefined {
  const result = optionalNumber(value, path);
  if (result === undefined) return undefined;
  if (!Number.isInteger(result)) throw new Error(`${path} must be an integer`);
  return result;
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return requiredString(value, path);
}

function assignOptional(target: JsonRecord, key: string, value: unknown, path: string): void {
  const normalized = optionalString(value, path);
  if (normalized !== undefined) Object.assign(target, { [key]: normalized });
}

function normalizeAudioDerivative(value: unknown, path: string): JsonRecord | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) throw new Error(`${path} must be an object`);

  const result: JsonRecord = {
    uri: requiredString(value.uri, `${path}.uri`),
  };
  assignOptional(result, "mimeType", value.mimeType, `${path}.mimeType`);
  const duration = optionalNumber(value.duration, `${path}.duration`);
  const sampleRate = optionalInteger(value.sampleRate, `${path}.sampleRate`);
  const channels = optionalInteger(value.channels, `${path}.channels`);
  if (duration !== undefined) result.duration = duration;
  if (sampleRate !== undefined) result.sampleRate = sampleRate;
  if (channels !== undefined) result.channels = channels;
  assignOptional(result, "integrity", value.integrity, `${path}.integrity`);
  return result;
}

/** Keep only fields defined by the canonical V2 asset discriminated union. */
function normalizeAsset(value: unknown, index: number): JsonRecord {
  const path = `assets.${index}`;
  if (!isRecord(value)) throw new Error(`${path} must be an object`);

  const id = requiredString(value.id, `${path}.id`);
  const uri = requiredString(value.uri, `${path}.uri`);
  const kind = requiredString(value.kind, `${path}.kind`);
  const result: JsonRecord = { id, kind, uri };

  if (kind === "image") {
    assignOptional(result, "mimeType", value.mimeType, `${path}.mimeType`);
    const width = optionalNumber(value.width, `${path}.width`);
    const height = optionalNumber(value.height, `${path}.height`);
    if (width !== undefined) result.width = width;
    if (height !== undefined) result.height = height;
    assignOptional(result, "integrity", value.integrity, `${path}.integrity`);
    return result;
  }

  if (kind === "video") {
    assignOptional(result, "mimeType", value.mimeType, `${path}.mimeType`);
    const width = optionalNumber(value.width, `${path}.width`);
    const height = optionalNumber(value.height, `${path}.height`);
    const duration = optionalNumber(value.duration, `${path}.duration`);
    const fps = optionalNumber(value.fps, `${path}.fps`);
    if (width !== undefined) result.width = width;
    if (height !== undefined) result.height = height;
    if (duration !== undefined) result.duration = duration;
    if (fps !== undefined) result.fps = fps;
    const audio = normalizeAudioDerivative(value.audio, `${path}.audio`);
    if (audio !== undefined) result.audio = audio;
    assignOptional(result, "integrity", value.integrity, `${path}.integrity`);
    return result;
  }

  if (kind === "audio") {
    result.mimeType = requiredString(value.mimeType, `${path}.mimeType`);
    const duration = optionalNumber(value.duration, `${path}.duration`);
    const sampleRate = optionalInteger(value.sampleRate, `${path}.sampleRate`);
    const channels = optionalInteger(value.channels, `${path}.channels`);
    if (duration !== undefined) result.duration = duration;
    if (sampleRate !== undefined) result.sampleRate = sampleRate;
    if (channels !== undefined) result.channels = channels;
    assignOptional(result, "integrity", value.integrity, `${path}.integrity`);
    return result;
  }

  if (kind === "font") {
    result.weight = requiredNumber(value.weight, `${path}.weight`);
    result.integrity = requiredString(value.integrity, `${path}.integrity`);
    return result;
  }

  throw new Error(`${path}.kind is unsupported: ${kind}`);
}

function textAlign(value: unknown): "left" | "right" | "center" | "start" | "end" | "justify" | "match-parent" | "justify-all" {
  if (value === "right") return "right";
  if (value === "center") return "center";
  if (value === "justify") return "justify";
  if (value === "start") return "start";
  if (value === "end") return "end";
  if (value === "match-parent") return "match-parent";
  if (value === "justify-all") return "justify-all";
  return "left";
}

function textAnchor(value: unknown): "start" | "middle" | "end" {
  if (value === "center") return "middle";
  if (value === "right") return "end";
  return "start";
}

function normalizeLegacyTextLayer(
  value: unknown,
  index: number,
  rawAssets: readonly unknown[],
): JsonRecord {
  if (!isRecord(value) || value.type !== "text" || !isRecord(value.payload)) {
    if (isRecord(value)) return value;
    throw new Error(`layers.${index} must be an object`);
  }

  const payload = value.payload;
  // Current V2 text already uses source/chunks and must pass through without
  // being rewritten.
  if (isRecord(payload.source) && Array.isArray(payload.chunks)) return value;

  if (typeof payload.text !== "string") {
    throw new Error(`layers.${index}.payload is neither canonical V2 text nor supported dev text shape`);
  }
  const fontAssetId = requiredString(payload.fontAssetId, `layers.${index}.payload.fontAssetId`);
  const fontAsset = rawAssets.find((asset) => isRecord(asset) && asset.id === fontAssetId);
  if (!isRecord(fontAsset) || fontAsset.kind !== "font") {
    throw new Error(`layers.${index}.payload.fontAssetId references missing font asset: ${fontAssetId}`);
  }

  const sourceText = payload.text.normalize("NFC");
  const fontFamily = typeof fontAsset.family === "string" && fontAsset.family.trim().length > 0
    ? fontAsset.family.trim()
    : "sans-serif";
  const font = {
    families: [fontFamily],
    size: requiredNumber(payload.fontSize, `layers.${index}.payload.fontSize`),
    ...(typeof fontAsset.weight === "number" ? { weight: fontAsset.weight } : {}),
    ...(fontAsset.style === "normal" || fontAsset.style === "italic" || fontAsset.style === "oblique"
      ? { style: fontAsset.style }
      : {}),
  };
  const align = textAlign(payload.align);
  const source: JsonRecord = {
    text: sourceText,
    ...(typeof payload.language === "string" && payload.language.trim() ? { language: payload.language.trim() } : {}),
    ...(payload.direction === "ltr" || payload.direction === "rtl" ? { direction: payload.direction } : {}),
  };
  const span: JsonRecord = {
    id: `${requiredString(value.id, `layers.${index}.id`)}::span`,
    sourceRange: { start: 0, end: sourceText.length },
    resolvedFontAssetIds: [fontAssetId],
    font,
    ...(isRecord(value.style) && value.style.fill !== undefined ? { fill: value.style.fill } : {}),
    letterSpacing: requiredNumber(payload.letterSpacing, `layers.${index}.payload.letterSpacing`),
  };
  const chunk: JsonRecord = {
    id: `${requiredString(value.id, `layers.${index}.id`)}::chunk`,
    sourceRange: { start: 0, end: sourceText.length },
    textAnchor: textAnchor(payload.align),
    spans: [span],
  };
  const lineHeight = requiredNumber(payload.lineHeight, `layers.${index}.payload.lineHeight`);
  const layout: JsonRecord = {
    lineHeight,
    sizing: "fixed",
    contentWidth: isRecord(value.frame) ? optionalNumber(value.frame.width, `layers.${index}.frame.width`) : undefined,
    contentHeight: isRecord(value.frame) ? optionalNumber(value.frame.height, `layers.${index}.frame.height`) : undefined,
    textAlign: align,
    whiteSpace: "normal",
    wrap: "none",
    textOverflow: "clip",
  };
  if (layout.contentWidth === undefined) delete layout.contentWidth;
  if (layout.contentHeight === undefined) delete layout.contentHeight;

  const baseLayer = { ...value };
  delete baseLayer.style;
  delete baseLayer.payload;
  return {
    ...baseLayer,
    payload: { source, layout, chunks: [chunk] },
  };
}

function inferredFontAssetId(
  family: string | undefined,
  rawAssets: readonly unknown[],
): string | undefined {
  const fontAssets = rawAssets.filter(
    (asset): asset is JsonRecord => isRecord(asset) && asset.kind === "font" && typeof asset.id === "string",
  );
  if (fontAssets.length === 0) return undefined;

  const familyToken = family?.trim().toLowerCase().replace(/\s+/g, "-");
  const matchingAsset = familyToken
    ? fontAssets.find((asset) => String(asset.id).toLowerCase().includes(familyToken))
    : undefined;
  if (matchingAsset && typeof matchingAsset.id === "string") return matchingAsset.id;
  return fontAssets.length === 1 && typeof fontAssets[0]?.id === "string"
    ? fontAssets[0].id
    : undefined;
}

function normalizeCanonicalTextLayer(
  value: JsonRecord,
  rawAssets: readonly unknown[],
): JsonRecord {
  if (!isRecord(value.payload) || !Array.isArray(value.payload.chunks)) return value;
  const payload = value.payload;

  const chunks = (payload.chunks as unknown[]).map((chunk) => {
    if (!isRecord(chunk) || !Array.isArray(chunk.spans)) return chunk;
    const spans = (chunk.spans as unknown[]).map((span) => {
      if (!isRecord(span) || Array.isArray(span.resolvedFontAssetIds) || !isRecord(span.font)) return span;
      const families = Array.isArray(span.font.families) ? span.font.families : [];
      const family = typeof families[0] === "string" ? families[0] : undefined;
      const fontAssetId = inferredFontAssetId(family, rawAssets);
      return fontAssetId ? { ...span, resolvedFontAssetIds: [fontAssetId] } : span;
    });
    return { ...chunk, spans };
  });

  return { ...value, payload: { ...payload, chunks } };
}

function normalizeDocument(value: unknown): MotionProtocolV2 {
  if (!isRecord(value)) throw new Error("document must be an object");
  if (!Array.isArray(value.assets)) throw new Error("document.assets must be an array");
  if (!Array.isArray(value.layers)) throw new Error("document.layers must be an array");

  const withCanonicalAssets = {
    ...value,
    assets: value.assets.map(normalizeAsset),
    layers: value.layers.map((layer, index) => {
      const normalized = normalizeLegacyTextLayer(layer, index, value.assets as readonly unknown[]);
      return isRecord(normalized) && normalized.type === "text"
        ? normalizeCanonicalTextLayer(normalized, value.assets as readonly unknown[])
        : normalized;
    }),
  };
  const migrated = migrateMotionProtocolV2(withCanonicalAssets);
  return MotionProtocolV2Schema.parse(migrated.input);
}

function hashDocument(document: MotionProtocolV2): string {
  return createHash("sha256").update(JSON.stringify(document)).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function documentByteSize(document: MotionProtocolV2): number {
  return Buffer.byteLength(JSON.stringify(document), "utf8");
}

function describeFailure(value: unknown): string {
  if (value instanceof Error) return value.message;
  return String(value);
}

async function main(): Promise<void> {
  let projectQuery = supabase
    .from("projects")
    .select("id, title, current_revision_no, created_by")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (projectId) projectQuery = projectQuery.eq("id", projectId);

  const { data: projectData, error: projectError } = await projectQuery;
  if (projectError) throw new Error(`unable to read projects: ${projectError.message}`);
  const projects = (projectData ?? []) as ProjectRow[];
  if (projects.length === 0) {
    console.log("No projects matched.");
    return;
  }

  const { data: revisionData, error: revisionError } = await supabase
    .from("project_revisions")
    .select("id, project_id, revision_no, document_json, created_by")
    .in("project_id", projects.map((project) => project.id))
    .order("revision_no", { ascending: false });
  if (revisionError) throw new Error(`unable to read project revisions: ${revisionError.message}`);

  const latestByProject = new Map<string, RevisionRow>();
  for (const revision of (revisionData ?? []) as RevisionRow[]) {
    if (!latestByProject.has(revision.project_id)) latestByProject.set(revision.project_id, revision);
  }

  const projectById = new Map(projects.map((project) => [project.id, project]));
  let valid = 0;
  let migrated = 0;
  let failed = 0;

  for (const revision of latestByProject.values()) {
    const project = projectById.get(revision.project_id);
    if (!project) continue;

    let document: MotionProtocolV2;
    try {
      document = normalizeDocument(revision.document_json);
    } catch (error) {
      failed += 1;
      console.error(`FAILED ${project.title} (${project.id}) revision ${revision.revision_no}: ${describeFailure(error)}`);
      continue;
    }

    // Zod may return the same object with a different property insertion
    // order. Compare semantic JSON, not presentation order, so this script is
    // safe to rerun without creating duplicate revisions.
    const original = stableJson(revision.document_json);
    const canonical = stableJson(document);
    if (original === canonical) {
      valid += 1;
      console.log(`VALID ${project.title} (${project.id}) revision ${revision.revision_no}`);
      continue;
    }

    migrated += 1;
    const nextRevisionNo = Math.max(project.current_revision_no, revision.revision_no) + 1;
    console.log(`${apply ? "MIGRATE" : "WOULD MIGRATE"} ${project.title} (${project.id}) ${revision.revision_no} -> ${nextRevisionNo}`);
    if (!apply) continue;

    const { error } = await supabase.from("project_revisions").insert({
      project_id: project.id,
      revision_no: nextRevisionNo,
      document_json: document,
      content_hash: hashDocument(document),
      source_schema_version: 2,
      reason: "restore",
      byte_size: documentByteSize(document),
      created_by: project.created_by || revision.created_by,
    });
    if (error) {
      failed += 1;
      console.error(`FAILED INSERT ${project.title} (${project.id}): ${error.message}`);
    }
  }

  console.log(`${apply ? "APPLY" : "DRY-RUN"} summary: valid=${valid}, migrated=${migrated}, failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
