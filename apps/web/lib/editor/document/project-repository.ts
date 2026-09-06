import "server-only";

import { createHash } from "node:crypto";
import { derivativeObjectKey } from "@/lib/server/r2";
import { listSystemAssetCatalog, systemAssetUrl, type SystemAssetRow } from "@/lib/server/system-assets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MotionProtocolV2Schema, type MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

type JsonObject = Record<string, unknown>;

type ProjectRow = {
  id: string;
  public_ref: string;
  workspace_id: string;
  title: string;
  current_revision_no: number;
  updated_at: string;
};

type RevisionRow = {
  id: string;
  revision_no: number;
  document_json: unknown;
};

const PROJECT_COLUMNS =
  "id, public_ref, workspace_id, title, current_revision_no, created_at, updated_at, last_activity_at, deleted_at, purge_after";
const REVISION_COLUMNS =
  "id, revision_no, document_json, content_hash, source_schema_version, reason, byte_size, created_at";

export type EditorProjectSnapshot = {
  projectId: string;
  publicRef: string;
  workspaceId: string;
  title: string;
  revisionNo: number;
  revisionId: string;
  document: MotionProtocolV2;
  source: "supabase";
};

export type EditorProjectListItem = Pick<
  EditorProjectSnapshot,
  "projectId" | "publicRef" | "workspaceId" | "title" | "revisionNo"
> & {
  updatedAt: string;
  layerCount: number;
  durationMs: number;
};

export type ProjectRepositoryErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "INVALID_DOCUMENT"
  | "REVISION_CONFLICT"
  | "DATABASE_ERROR";

export class ProjectRepositoryError extends Error {
  constructor(
    message: string,
    readonly code: ProjectRepositoryErrorCode,
  ) {
    super(message);
    this.name = "ProjectRepositoryError";
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function hashDocument(document: JsonObject): string {
  return createHash("sha256").update(JSON.stringify(document)).digest("hex");
}

function documentByteSize(document: JsonObject): number {
  return Buffer.byteLength(JSON.stringify(document), "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function timingEnd(value: unknown): number {
  if (!isRecord(value) || !isRecord(value.timing)) return 0;

  const start = Number(value.timing.start);
  const duration = Number(value.timing.duration);
  if (!Number.isFinite(start) || !Number.isFinite(duration)) return 0;
  return Math.max(0, start) + Math.max(0, duration);
}

function documentDurationMs(value: unknown): number {
  if (!isRecord(value)) return 0;

  let durationMs = 0;
  if (Array.isArray(value.layers)) {
    for (const layer of value.layers) {
      durationMs = Math.max(durationMs, timingEnd(layer));
    }
  }

  if (isRecord(value.audio) && Array.isArray(value.audio.tracks)) {
    for (const track of value.audio.tracks) {
      if (!isRecord(track) || !Array.isArray(track.clips)) continue;
      for (const clip of track.clips) {
        durationMs = Math.max(durationMs, timingEnd(clip));
      }
    }
  }

  return durationMs;
}

function parseFailureDetail(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error && Array.isArray(error.issues)) {
    const issue = error.issues[0] as { path?: unknown; message?: unknown } | undefined;
    if (issue && typeof issue.message === "string") {
      const path = Array.isArray(issue.path) && issue.path.length > 0
        ? ` at ${issue.path.map(String).join(".")}`
        : "";
      return `${issue.message}${path}`;
    }
  }
  return "schema validation failed";
}

async function authenticatedClient() {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new ProjectRepositoryError(
      "Sign in to access this project",
      "UNAUTHENTICATED",
    );
  }
  return { client, user: data.user };
}

async function findProject(client: Awaited<ReturnType<typeof createSupabaseServerClient>>, projectRef: string) {
  const query = client
    .from("projects")
    .select(PROJECT_COLUMNS)
    .is("deleted_at", null);
  const { data, error } = isUuid(projectRef)
    ? await query.eq("id", projectRef).maybeSingle()
    : await query.eq("public_ref", projectRef).maybeSingle();

  if (error) {
    throw new ProjectRepositoryError(
      "Unable to read project",
      "DATABASE_ERROR",
    );
  }
  if (!data) {
    throw new ProjectRepositoryError(
      "Project not found or access denied",
      "NOT_FOUND",
    );
  }
  return data as unknown as ProjectRow;
}

async function latestRevision(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  projectId: string,
) {
  const { data, error } = await client
    .from("project_revisions")
    .select(REVISION_COLUMNS)
    .eq("project_id", projectId)
    .order("revision_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ProjectRepositoryError(
      "Unable to read project revision",
      "DATABASE_ERROR",
    );
  }
  if (!data) {
    throw new ProjectRepositoryError(
      "Project has no source revision",
      "NOT_FOUND",
    );
  }
  return data as unknown as RevisionRow;
}

function parseDocument(value: unknown): MotionProtocolV2 {
  try {
    // The editor owns Protocol V2 documents only. Do not run the package-level
    // migration parser here: legacy documents must be rejected and recreated
    // while the product is still in development.
    return MotionProtocolV2Schema.parse(value);
  } catch (error) {
    throw new ProjectRepositoryError(
      `Project source is not a valid Motion Protocol V2 document: ${parseFailureDetail(error)}`,
      "INVALID_DOCUMENT",
    );
  }
}

/**
 * Project revisions intentionally keep Protocol V2 authoring data, not
 * public R2 URLs. Resolve asset references to short-lived private URLs only
 * at the server boundary so an old revision can be opened after a URL expires
 * and a public custom domain is never required.
 */
async function hydratePrivateAssetUrls(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  workspaceId: string,
  document: MotionProtocolV2,
): Promise<MotionProtocolV2> {
  const userAssetIds = document.assets
    .map((asset) => asset.id.startsWith("asset-") ? asset.id.slice("asset-".length) : asset.id)
    .filter(isUuid);
  const systemAssetIds = document.assets
    .map((asset) => asset.id)
    .filter((id) => id.startsWith("system:"));

  const userAssets = userAssetIds.length > 0
    ? await client
      .from("assets")
      .select("id, r2_key, status")
      .eq("workspace_id", workspaceId)
      .in("id", userAssetIds)
      .is("deleted_at", null)
      .eq("status", "ready")
    : { data: [], error: null };
  if (userAssets.error) return document;

  const systemAssets = systemAssetIds.length > 0
    ? await listSystemAssetCatalog([...new Set(systemAssetIds)])
    : [];
  const data = (userAssets.data ?? []) as Array<{ id: string; r2_key: string; status: string }>;
  const systemOrigins = new Map(
    systemAssets
      .filter((asset: SystemAssetRow) => asset.variant_kind === "origin" && asset.parent_id === null)
      .map((asset: SystemAssetRow) => [asset.id, asset]),
  );

  const { data: variants } = data.length > 0
    ? await client
      .from("asset_variants")
      .select("asset_id, r2_key, variant_kind, mime_type, metadata_json")
      .in("asset_id", data.map((asset) => asset.id))
    : { data: [] };
  const audioVariants = new Map<string, { key: string; mimeType: string; metadata: Record<string, unknown> }>();
  for (const variant of (variants ?? []) as Array<{ asset_id?: unknown; r2_key?: unknown; variant_kind?: unknown; mime_type?: unknown; metadata_json?: unknown }>) {
    if (typeof variant.asset_id !== "string" || typeof variant.r2_key !== "string" || typeof variant.mime_type !== "string") continue;
    const canonicalAudioKey = derivativeObjectKey(workspaceId, variant.asset_id, "audio", "audio.m4a");
    if (!(variant.variant_kind === "audio" || variant.variant_kind === "proxy") || (variant.r2_key !== canonicalAudioKey && !variant.r2_key.includes("/audio/"))) continue;
    const metadata = variant.metadata_json && typeof variant.metadata_json === "object"
      ? variant.metadata_json as Record<string, unknown>
      : {};
    audioVariants.set(variant.asset_id, { key: variant.r2_key, mimeType: variant.mime_type, metadata });
  }

  // Keep the bucket private. Browser media is read through the authenticated
  // same-origin range proxy, so no R2 CORS policy or public custom domain is
  // required and signed URLs never enter the authoring document.
  const urls = new Map<string, string>();
  for (const asset of data) {
    if (asset.r2_key) urls.set(asset.id, `/api/assets/${encodeURIComponent(asset.id)}/media`);
  }
  for (const asset of systemOrigins.values()) urls.set(asset.id, systemAssetUrl(asset.id));

  if (urls.size === 0) return document;
  return {
    ...document,
    assets: document.assets.map((asset) => {
      const dbId = asset.id.startsWith("asset-") ? asset.id.slice("asset-".length) : asset.id;
      const uri = urls.get(dbId);
      if (!uri) return asset;
      const systemAsset = systemOrigins.get(dbId);
      if (systemAsset) {
        const metadata = systemAsset.metadata_json ?? {};
        if (asset.kind === "video") {
          return {
            ...asset,
            uri,
            mimeType: systemAsset.mime_type,
            ...(systemAsset.width ? { width: systemAsset.width } : {}),
            ...(systemAsset.height ? { height: systemAsset.height } : {}),
            ...(systemAsset.duration_ms !== null ? { duration: systemAsset.duration_ms } : {}),
            ...(typeof metadata.fps === "number" ? { fps: metadata.fps } : {}),
          };
        }
        if (asset.kind === "audio") {
          return {
            ...asset,
            uri,
            mimeType: systemAsset.mime_type,
            ...(systemAsset.duration_ms !== null ? { duration: systemAsset.duration_ms } : {}),
            ...(typeof metadata.sampleRate === "number" ? { sampleRate: metadata.sampleRate } : {}),
            ...(typeof metadata.channels === "number" ? { channels: metadata.channels } : {}),
          };
        }
        if (asset.kind === "image") {
          return {
            ...asset,
            uri,
            mimeType: systemAsset.mime_type,
            ...(systemAsset.width ? { width: systemAsset.width } : {}),
            ...(systemAsset.height ? { height: systemAsset.height } : {}),
          };
        }
        return { ...asset, uri };
      }
      const audioVariant = asset.kind === "video" ? audioVariants.get(dbId) : undefined;
      const existingAudio = asset.kind === "video" ? asset.audio : undefined;
      const audio = asset.kind === "video" && (existingAudio || audioVariant)
        ? {
            ...(existingAudio ?? {}),
            uri: `/api/assets/${encodeURIComponent(dbId)}/media?variant=audio`,
            ...(audioVariant?.mimeType ? { mimeType: audioVariant.mimeType } : {}),
            ...(typeof audioVariant?.metadata.duration === "number" ? { duration: audioVariant.metadata.duration } : {}),
            ...(typeof audioVariant?.metadata.sampleRate === "number" ? { sampleRate: audioVariant.metadata.sampleRate } : {}),
            ...(typeof audioVariant?.metadata.channels === "number" ? { channels: audioVariant.metadata.channels } : {}),
          }
        : undefined;
      return {
        ...asset,
        uri,
        ...(audio ? { audio } : {}),
      };
    }),
  };
}

export async function loadProject(
  projectRef: string,
): Promise<EditorProjectSnapshot> {
  const { client } = await authenticatedClient();
  const project = await findProject(client, projectRef);
  const revision = await latestRevision(client, project.id);
  const document = await hydratePrivateAssetUrls(
    client,
    project.workspace_id,
    parseDocument(revision.document_json),
  );

  return {
    projectId: project.id,
    publicRef: project.public_ref,
    workspaceId: project.workspace_id,
    title: project.title,
    revisionNo: revision.revision_no,
    revisionId: revision.id,
    document,
    source: "supabase",
  };
}

export async function listProjects(
  limit = 50,
): Promise<EditorProjectListItem[]> {
  const { client } = await authenticatedClient();
  const { data, error } = await client
    .from("projects")
    .select(PROJECT_COLUMNS)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));

  if (error) {
    throw new ProjectRepositoryError(
      "Unable to list projects",
      "DATABASE_ERROR",
    );
  }
  const rows = (data ?? []) as unknown as ProjectRow[];

  if (rows.length === 0) return [];

  const { data: revisions, error: revisionsError } = await client
    .from("project_revisions")
    .select("project_id, revision_no, document_json")
    .in("project_id", rows.map((project) => project.id))
    .order("revision_no", { ascending: false });

  if (revisionsError) {
    throw new ProjectRepositoryError(
      "Unable to read project revisions",
      "DATABASE_ERROR",
    );
  }

  const revisionRows = (revisions ?? []) as Array<{
    project_id: string;
    document_json: unknown;
  }>;
  const latestByProject = new Map<string, unknown>();
  for (const revision of revisionRows) {
    if (!latestByProject.has(revision.project_id)) {
      latestByProject.set(revision.project_id, revision.document_json);
    }
  }

  return rows.map((project) => {
    const document = latestByProject.get(project.id);
    return {
      projectId: project.id,
      publicRef: project.public_ref,
      workspaceId: project.workspace_id,
      title: project.title,
      revisionNo: project.current_revision_no,
      updatedAt: project.updated_at,
      layerCount: isRecord(document) && Array.isArray(document.layers)
        ? document.layers.length
        : 0,
      durationMs: documentDurationMs(document),
    };
  });
}

export async function saveProject(
  projectRef: string,
  document: MotionProtocolV2,
  expectedRevisionNo: number,
): Promise<EditorProjectSnapshot> {
  const { client, user } = await authenticatedClient();
  const project = await findProject(client, projectRef);
  const currentRevision = await latestRevision(client, project.id);

  if (currentRevision.revision_no !== expectedRevisionNo) {
    throw new ProjectRepositoryError(
      `Revision conflict: expected ${expectedRevisionNo}, current is ${currentRevision.revision_no}`,
      "REVISION_CONFLICT",
    );
  }

  const validDocument = parseDocument(document);
  const nextRevisionNo = currentRevision.revision_no + 1;
  const documentJson = validDocument as unknown as JsonObject;

  // Keep the relational project_assets index in sync with V2 asset references.
  // System assets use catalog IDs, while workspace assets use asset-{uuid} IDs.
  const referencedMediaAssetIds = [
    ...new Set(
      validDocument.assets
        .filter((asset) => asset.kind !== "font")
        .map((asset) => asset.id.replace(/^asset-/, ""))
        .filter(isUuid),
    ),
  ];
  if (referencedMediaAssetIds.length > 0) {
    const { data: workspaceAssets, error: assetsError } = await client
      .from("assets")
      .select("id")
      .eq("workspace_id", project.workspace_id)
      .in("id", referencedMediaAssetIds)
      .is("deleted_at", null);

    if (assetsError) {
      throw new ProjectRepositoryError(
        "Unable to resolve project assets",
        "DATABASE_ERROR",
      );
    }

    const workspaceAssetRows = (workspaceAssets ?? []) as unknown as Array<{ id: string }>;
    const links = workspaceAssetRows.map((asset) => ({
      project_id: project.id,
      asset_id: asset.id,
      attached_by: user.id,
    }));
    if (links.length > 0) {
      const { error: linksError } = await client
        .from("project_assets")
        .upsert(links, { onConflict: "project_id,asset_id", ignoreDuplicates: true });
      if (linksError) {
        throw new ProjectRepositoryError(
          "Unable to attach project assets",
          "DATABASE_ERROR",
        );
      }
    }
  }

  const referencedFontAssetIds = validDocument.assets
    .filter((asset) => asset.kind === "font")
    .map((asset) => asset.id.replace(/^asset-/, ""))
    .filter(isUuid);
  if (referencedFontAssetIds.length > 0) {
    const { data: fontFaces, error: fontFacesError } = await client
      .from("user_font_faces")
      .select("font_family_id, asset_id")
      .in("asset_id", referencedFontAssetIds)
      .eq("enabled", true);
    if (fontFacesError) {
      throw new ProjectRepositoryError("Unable to resolve project fonts", "DATABASE_ERROR");
    }
    const fontLinks = [...new Map((fontFaces ?? []).map((face: unknown) => {
      const row = face as { font_family_id: string };
      return [row.font_family_id, row] as const;
    })).values()]
      .map((face) => ({ project_id: project.id, font_family_id: face.font_family_id, created_by: user.id }));
    if (fontLinks.length > 0) {
      const { error: fontLinksError } = await client
        .from("project_font_families")
        .upsert(fontLinks, { onConflict: "project_id,font_family_id", ignoreDuplicates: true });
      if (fontLinksError) throw new ProjectRepositoryError("Unable to attach project fonts", "DATABASE_ERROR");
    }
  }

  const { data: revision, error } = await client
    .from("project_revisions")
    .insert({
      project_id: project.id,
      revision_no: nextRevisionNo,
      document_json: documentJson,
      content_hash: hashDocument(documentJson),
      source_schema_version: validDocument.formatVersion,
      reason: "autosave",
      byte_size: documentByteSize(documentJson),
      created_by: user.id,
    })
    .select(REVISION_COLUMNS)
    .single();

  if (error) {
    throw new ProjectRepositoryError(
      "Unable to save project revision",
      error.code === "23505" ? "REVISION_CONFLICT" : "DATABASE_ERROR",
    );
  }

  const savedRevision = revision as unknown as RevisionRow;

  return {
    projectId: project.id,
    publicRef: project.public_ref,
    workspaceId: project.workspace_id,
    title: project.title,
    revisionNo: savedRevision.revision_no,
    revisionId: savedRevision.id,
    document: validDocument,
    source: "supabase",
  };
}

export async function attachProjectAsset(
  projectRef: string,
  assetId: string,
): Promise<void> {
  if (!isUuid(assetId)) {
    throw new ProjectRepositoryError("Asset not found", "NOT_FOUND");
  }

  const { client, user } = await authenticatedClient();
  const project = await findProject(client, projectRef);
  const { data: asset, error: assetError } = await client
    .from("assets")
    .select("id")
    .eq("id", assetId)
    .eq("workspace_id", project.workspace_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (assetError || !asset) {
    throw new ProjectRepositoryError("Asset not found", "NOT_FOUND");
  }

  const { error: linkError } = await client
    .from("project_assets")
    .upsert(
      [{ project_id: project.id, asset_id: asset.id, attached_by: user.id }],
      { onConflict: "project_id,asset_id", ignoreDuplicates: true },
    );
  if (linkError) {
    throw new ProjectRepositoryError(
      "Unable to attach project asset",
      "DATABASE_ERROR",
    );
  }
}
