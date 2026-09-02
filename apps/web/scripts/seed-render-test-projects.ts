/* eslint-disable @typescript-eslint/no-unsafe-assignment, import/order, no-console */

import { loadEnvConfig } from "@next/env";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { MotionProtocolV2Schema, type MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { getUserAssetsProvider, publicUserAssetUrl } from "@/lib/server/r2";

loadEnvConfig(process.cwd(), false);

const TEST_PREFIX = "[Render test]";
const FONT_ID = "font-roboto-regular";
// Keep the built-in font same-origin so local preview and the deployed app
// resolve the exact public asset without depending on a cross-origin app host.
const FONT_URI = "/preview/font/Roboto-Regular.ttf";
const FONT_INTEGRITY = "sha256:15256405ecb0d880678833a582760efad538ab2932318b52c8105b267d159459";

type DbAsset = {
  id: string;
  original_filename: string | null;
  mime_type: string;
  byte_size: number;
  status: string;
  r2_key: string;
  source_duration_ms: number | null;
  source_width: number | null;
  source_height: number | null;
};

type AssetRef = {
  id: string;
  dbId: string;
  kind: "image" | "video" | "audio";
  uri: string;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
  sampleRate?: number;
};

const view: MotionProtocolV2["composition"]["view"] = {
  projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
  transform: {
    translate: { x: 0, y: 0, z: 0 },
    rotate: { x: 0, y: 0, z: 0 },
  },
};

function transform(x: number, y: number, width: number, height: number) {
  return {
    translate: { x, y, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    rotate: { x: 0, y: 0, z: 0 },
    skew: { x: 0, y: 0 },
    anchor: { x: width / 2, y: height / 2, z: 0 },
  } as const;
}

function fontAsset() {
  return {
    id: FONT_ID,
    kind: "font" as const,
    uri: FONT_URI,
    mimeType: "font/ttf" as const,
    family: "Roboto",
    weight: 400,
    style: "normal" as const,
    integrity: FONT_INTEGRITY,
  };
}

function baseProject(id: string, duration: number, background: string): MotionProtocolV2 {
  return {
    format: "motion-protocol",
    formatVersion: 2,
    id,
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background,
      colorSpace: "srgb",
      view,
    },
    assets: [fontAsset()],
    layers: [],
    audio: { sampleRate: 48000, tracks: [] },
  };
}

function shape(input: {
  id: string;
  order: number;
  start: number;
  duration: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  opacity?: number;
  shape?: "rectangle" | "ellipse";
}) {
  return {
    id: input.id,
    type: "shape" as const,
    parentLayerId: null,
    order: input.order,
    frame: { width: input.width, height: input.height },
    transform: transform(input.x, input.y, input.width, input.height),
    opacity: input.opacity ?? 1,
    timing: { start: input.start * 1000, duration: input.duration * 1000 },
    payload: { shape: input.shape ?? "rectangle", cornerRadius: input.shape === "ellipse" ? undefined : 24 },
    style: { fill: input.fill },
  };
}

function text(input: {
  id: string;
  order: number;
  start: number;
  duration: number;
  value: string;
  x?: number;
  y?: number;
  size?: number;
  fill?: string;
}) {
  const width = 1600;
  const height = 160;
  const source = input.value.normalize("NFC");
  return {
    id: input.id,
    type: "text" as const,
    parentLayerId: null,
    order: input.order,
    frame: { width, height },
    transform: transform(input.x ?? 160, input.y ?? 460, width, height),
    opacity: 1,
    timing: { start: input.start * 1000, duration: input.duration * 1000 },
    payload: {
      source: { text: source, language: "en" },
      chunks: [{
        id: `${input.id}-chunk`,
        sourceRange: { start: 0, end: source.length },
        spans: [{
          id: `${input.id}-span`,
          sourceRange: { start: 0, end: source.length },
          font: { families: ["Roboto"], size: input.size ?? 64 },
          fill: input.fill ?? "#ffffff",
        }],
      }],
    },
  };
}

function imageLayer(input: { id: string; order: number; assetId: string; start: number; duration: number; x: number; y: number; width: number; height: number; opacity?: number }) {
  return {
    id: input.id,
    type: "image" as const,
    parentLayerId: null,
    order: input.order,
    frame: { width: input.width, height: input.height },
    transform: transform(input.x, input.y, input.width, input.height),
    opacity: input.opacity ?? 1,
    timing: { start: input.start * 1000, duration: input.duration * 1000 },
    payload: { assetId: input.assetId, width: input.width, height: input.height, preserveAspectRatio: { align: "xMidYMid" as const, meetOrSlice: "slice" as const } },
  };
}

function videoLayer(input: { id: string; order: number; assetId: string; start: number; duration: number }) {
  return {
    id: input.id,
    type: "video" as const,
    parentLayerId: null,
    order: input.order,
    frame: { width: 1920, height: 1080 },
    transform: transform(0, 0, 1920, 1080),
    opacity: 1,
    timing: { start: input.start * 1000, duration: input.duration * 1000 },
    payload: {
      assetId: input.assetId,
      fit: "cover" as const,
      // The video element is muted; the compiler links its detected audio
      // derivative as a separate mix input when this is enabled.
      audio: { enabled: true, gainDb: 0, pan: 0 },
      framePolicy: "floor" as const,
    },
  };
}

function addAudio(project: MotionProtocolV2, asset: AssetRef, duration: number, id: string): MotionProtocolV2 {
  return {
    ...project,
    audio: {
      sampleRate: 48000 as const,
    tracks: [{
      id: `${id}-track`,
      gainDb: 0,
      pan: 0,
      muted: false,
      clips: [{
        id: `${id}-clip`,
        assetId: asset.id,
        timing: { start: 0, duration: duration * 1000 },
        trim: { start: 0, end: duration * 1000 },
        enabled: true,
        gainDb: 0,
        pan: 0,
        playbackRate: 1,
        fadeIn: { duration: 2000, curve: "equal-power" as const },
        fadeOut: { duration: 3000, curve: "equal-power" as const },
      }],
    }],
    },
  };
}

function withAssets(project: MotionProtocolV2, assets: AssetRef[]) {
  return {
    ...project,
    assets: [...project.assets, ...assets.map((asset) => {
      if (asset.kind === "image") return {
        id: asset.id,
        kind: "image" as const,
        uri: asset.uri,
        mimeType: asset.mimeType,
        ...(asset.width != null ? { width: asset.width } : {}),
        ...(asset.height != null ? { height: asset.height } : {}),
      };
      if (asset.kind === "video") return {
        id: asset.id,
        kind: "video" as const,
        uri: asset.uri,
        mimeType: asset.mimeType,
        ...(asset.width != null ? { width: asset.width } : {}),
        ...(asset.height != null ? { height: asset.height } : {}),
        ...(asset.duration != null ? { duration: asset.duration * 1000 } : {}),
        ...(asset.fps != null ? { fps: asset.fps } : {}),
      };
      return {
        id: asset.id,
        kind: "audio" as const,
        uri: asset.uri,
        mimeType: asset.mimeType,
        ...(asset.duration != null ? { duration: asset.duration * 1000 } : {}),
        ...(asset.sampleRate != null ? { sampleRate: asset.sampleRate } : {}),
      };
    })],
  };
}

function availableDuration(asset: AssetRef, requested: number): number {
  return Math.min(requested, asset.duration ?? requested);
}

function buildProjects(assets: Record<string, AssetRef>): Array<{ title: string; document: MotionProtocolV2; assetDbIds: string[] }> {
  const font = fontAsset();
  const userAssets = (...refs: AssetRef[]) => refs.map((ref) => ref.dbId);

  const p1 = baseProject("render-test-text-shapes-60s", 60, "#101820");
  p1.layers = [shape({ id: "background", order: 0, start: 0, duration: 60, x: 0, y: 0, width: 1920, height: 1080, fill: "#101820" })];
  for (let index = 0; index < 5; index += 1) {
    p1.layers.push(shape({ id: `keyframe-shape-${index + 1}`, order: index + 1, start: index * 12, duration: 12, x: 180 + index * 300, y: 220 + (index % 2) * 420, width: 260, height: 180, fill: ["#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9"][index], shape: index % 2 ? "ellipse" : "rectangle" }));
    p1.layers.push(text({ id: `keyframe-text-${index + 1}`, order: 10 + index, start: index * 12, duration: 12, value: `Timed keyframe ${index + 1}`, y: 470, size: 52 }));
  }
  p1.assets = [font];

  const p2 = withAssets(baseProject("render-test-media-mix-60s", 60, "#08111f"), [assets.videoShort, assets.imageLandscape, assets.imageAlpha, assets.audioShort]);
  p2.layers = [
    videoLayer({ id: "video-background", order: 0, assetId: assets.videoShort.id, start: 0, duration: 60 }),
    imageLayer({ id: "landscape-overlay", order: 1, assetId: assets.imageLandscape.id, start: 0, duration: 30, x: 120, y: 120, width: 720, height: 405, opacity: 0.82 }),
    imageLayer({ id: "alpha-overlay", order: 2, assetId: assets.imageAlpha.id, start: 30, duration: 30, x: 1200, y: 520, width: 420, height: 420 }),
    text({ id: "media-title", order: 3, start: 0, duration: 60, value: "Media mix benchmark", size: 72 }),
  ];
  const p2WithAudio = addAudio(p2, assets.audioShort, 60, "media-mix-audio");

  const p3Base = withAssets(baseProject("render-test-video-source-5m", 300, "#06101a"), [assets.videoLong, assets.audioLong]);
  const p3 = addAudio(p3Base, assets.audioLong, 300, "five-minute-audio");
  p3.layers = [
    videoLayer({ id: "five-minute-video", order: 0, assetId: assets.videoLong.id, start: 0, duration: availableDuration(assets.videoLong, 300) }),
    text({ id: "five-minute-title", order: 1, start: 0, duration: 300, value: "Five-minute 1080p30 source test", size: 58, y: 850 }),
  ];

  const p4 = baseProject("render-test-timeline-shapes-5m", 300, "#111827");
  p4.layers = [shape({ id: "timeline-background", order: 0, start: 0, duration: 300, x: 0, y: 0, width: 1920, height: 1080, fill: "#111827" })];
  for (let index = 0; index < 25; index += 1) {
    const start = index * 12;
    p4.layers.push(shape({ id: `timeline-shape-${index + 1}`, order: index + 1, start, duration: 12, x: 120 + (index % 5) * 380, y: 180 + (Math.floor(index / 5) % 4) * 190, width: 300, height: 140, fill: index % 2 ? "#334155" : "#0f766e", shape: index % 3 === 0 ? "ellipse" : "rectangle" }));
    p4.layers.push(text({ id: `timeline-label-${index + 1}`, order: 40 + index, start, duration: 12, value: `Scene ${String(index + 1).padStart(2, "0")}`, y: 470, size: 42 }));
  }
  p4.assets = [font];

  const p5Base = withAssets(baseProject("render-test-heavy-composite-5m", 300, "#0b1020"), [assets.videoLong, assets.imageLandscape, assets.imageSquare, assets.imageAlpha, assets.svg, assets.audioLong]);
  const p5 = p5Base;
  p5.layers = [
    videoLayer({ id: "composite-video", order: 0, assetId: assets.videoLong.id, start: 0, duration: availableDuration(assets.videoLong, 300) }),
    imageLayer({ id: "composite-landscape", order: 1, assetId: assets.imageLandscape.id, start: 0, duration: 300, x: 0, y: 0, width: 1920, height: 1080, opacity: 0.28 }),
    imageLayer({ id: "composite-square", order: 2, assetId: assets.imageSquare.id, start: 0, duration: 150, x: 130, y: 180, width: 560, height: 560, opacity: 0.9 }),
    imageLayer({ id: "composite-alpha", order: 3, assetId: assets.imageAlpha.id, start: 150, duration: 150, x: 1230, y: 180, width: 560, height: 560 }),
    imageLayer({ id: "composite-svg", order: 4, assetId: assets.svg.id, start: 0, duration: 300, x: 760, y: 760, width: 400, height: 200, opacity: 0.95 }),
    text({ id: "composite-title", order: 5, start: 0, duration: 300, value: "Five-minute mixed-media stress test", size: 66, y: 430 }),
  ];
  const p5WithAudio = addAudio(p5, assets.audioLong, 300, "composite-audio");

  return [
    { title: `${TEST_PREFIX} 01 — 60s Text + Shapes`, document: p1, assetDbIds: [] },
    { title: `${TEST_PREFIX} 02 — 60s Media Mix`, document: p2WithAudio, assetDbIds: userAssets(assets.videoShort, assets.imageLandscape, assets.imageAlpha, assets.audioShort) },
    { title: `${TEST_PREFIX} 03 — 5m Video Source`, document: p3, assetDbIds: userAssets(assets.videoLong, assets.audioLong) },
    { title: `${TEST_PREFIX} 04 — 5m Timeline Shapes`, document: p4, assetDbIds: [] },
    { title: `${TEST_PREFIX} 05 — 5m Heavy Composite`, document: p5WithAudio, assetDbIds: userAssets(assets.videoLong, assets.imageLandscape, assets.imageSquare, assets.imageAlpha, assets.svg, assets.audioLong) },
  ];
}

function hashDocument(document: MotionProtocolV2): string {
  return createHash("sha256").update(JSON.stringify(document)).digest("hex");
}

async function main() {
  const refresh = process.argv.includes("--refresh");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase environment is not configured");
  const db = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: users, error: usersError } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw usersError;
  const user = users.users.find((candidate) => candidate.email?.toLowerCase() === "demo1@gmail.com");
  if (!user) throw new Error("demo1@gmail.com was not found");
  const { data: membership, error: membershipError } = await db.from("workspace_members").select("workspace_id").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (membershipError || !membership) throw membershipError ?? new Error("Demo workspace was not found");

  const { data: rows, error: assetsError } = await db.from("assets").select("id, original_filename, mime_type, byte_size, status, r2_key, source_duration_ms, source_width, source_height").eq("workspace_id", membership.workspace_id).eq("status", "ready").is("deleted_at", null);
  if (assetsError) throw assetsError;
  const byName = new Map((rows as DbAsset[]).map((asset) => [asset.original_filename?.toLowerCase(), asset]));
  const required = ["video-1080p.mp4", "Video Project.mp4", "tinh-yeu-mau-nang-128k.mp3", "Music-MBB-Island-Tropical_128k.mp3", "example16-9.jpg", "example1-1.jpg", "beer-can_8798947.png", "cute_7980701.png", "Whatapp-icon.svg"];
  for (const name of required) if (!byName.has(name.toLowerCase())) throw new Error(`Missing uploaded asset: ${name}`);

  const storage = getUserAssetsProvider();
  const objectUrl = async (asset: DbAsset): Promise<string> => {
    if (!asset.r2_key) throw new Error(`Missing R2 key for ${asset.original_filename}`);
    return publicUserAssetUrl(asset.r2_key)
      ?? (await storage.presignGet(asset.r2_key, 60 * 60 * 24 * 7)).url;
  };
  const ref = async (name: string, kind: AssetRef["kind"], extra: Partial<AssetRef> = {}): Promise<AssetRef> => {
    const dbAsset = byName.get(name.toLowerCase())!;
    return {
      id: `asset-${dbAsset.id}`,
      dbId: dbAsset.id,
      kind,
      uri: await objectUrl(dbAsset),
      mimeType: dbAsset.mime_type,
      ...extra,
      duration: dbAsset.source_duration_ms != null ? dbAsset.source_duration_ms / 1_000 : extra.duration,
      width: dbAsset.source_width ?? extra.width,
      height: dbAsset.source_height ?? extra.height,
    };
  };
  const assetRefs = {
    videoShort: await ref("Video Project.mp4", "video", { duration: 60.5, fps: 30, width: 1920, height: 1080 }),
    videoLong: await ref("video-1080p.mp4", "video", { duration: 260.06, fps: 30, width: 1920, height: 1080 }),
    audioShort: await ref("Music-MBB-Island-Tropical_128k.mp3", "audio", { duration: 124.55, sampleRate: 44100 }),
    audioLong: await ref("tinh-yeu-mau-nang-128k.mp3", "audio", { duration: 339.1, sampleRate: 44100 }),
    imageLandscape: await ref("example16-9.jpg", "image", { width: 1920, height: 1080 }),
    imageSquare: await ref("example1-1.jpg", "image", { width: 1920, height: 1920 }),
    imageAlpha: await ref("beer-can_8798947.png", "image", { width: 512, height: 512 }),
    svg: await ref("Whatapp-icon.svg", "image", { width: 512, height: 512, mimeType: "image/svg+xml" }),
  };

  const projects = buildProjects(assetRefs);
  const { data: existing, error: existingError } = await db.from("projects").select("id,title,current_revision_no").eq("workspace_id", membership.workspace_id).like("title", `${TEST_PREFIX}%`).is("deleted_at", null);
  if (existingError) throw existingError;
  const existingByTitle = new Map((existing ?? []).map((project) => [project.title, project]));
  let created = 0;
  let refreshed = 0;
  let skipped = 0;
  for (const entry of projects) {
    const parsed = MotionProtocolV2Schema.parse(entry.document);
    const existingProject = existingByTitle.get(entry.title);
    if (existingProject && !refresh) {
      skipped += 1;
      continue;
    }
    const project = existingProject ?? await (async () => {
      const { data, error } = await db.from("projects").insert({ workspace_id: membership.workspace_id, title: entry.title, created_by: user.id, current_revision_no: 0 }).select("id,title,current_revision_no").single();
      if (error || !data) throw error ?? new Error("Project insert returned no row");
      return data;
    })();
    const documentJson = parsed as unknown as Record<string, unknown>;
    const revisionNo = (existingProject?.current_revision_no ?? 0) + 1;
    const { error: revisionError } = await db.from("project_revisions").insert({ project_id: project.id, revision_no: revisionNo, document_json: documentJson, content_hash: hashDocument(parsed), source_schema_version: 2, reason: "import", byte_size: Buffer.byteLength(JSON.stringify(documentJson), "utf8"), created_by: user.id });
    if (revisionError) throw revisionError;
    if (entry.assetDbIds.length > 0) {
      const { error: linksError } = await db.from("project_assets").upsert(entry.assetDbIds.map((assetId) => ({ project_id: project.id, asset_id: assetId, attached_by: user.id })), { onConflict: "project_id,asset_id", ignoreDuplicates: true });
      if (linksError) throw linksError;
    }
    if (existingProject) refreshed += 1; else created += 1;
    console.log(`${existingProject ? "Refreshed" : "Created"} ${entry.title}: ${project.id}`);
  }
  console.log(`Render test projects: created ${created}, refreshed ${refreshed}, skipped ${skipped}.`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : JSON.stringify(error));
  process.exitCode = 1;
});
