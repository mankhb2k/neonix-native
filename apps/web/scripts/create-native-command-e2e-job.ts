/* eslint-disable no-console */

import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { compileDocument } from "@motionvideo/html-compiler";
import { HTML_COMPILER_PREVIEW_FONT_ASSETS } from "../lib/docs/html-compiler-preview";
import { compileAndPrepareRuntimeProjectV3 } from "../lib/server/render/project-runtime";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const cwd = resolve(process.cwd());
  const root = basename(cwd).toLowerCase() === "web" ? resolve(cwd, "../..") : cwd;
  const fixtureId = process.env.NATIVE_E2E_FIXTURE_ID?.trim() || "neonix-e2e-native-baseline-5s";
  const fixtureRoot = join(root, "apps", "web", "public", "docs", "benchmark");
  const manifest = JSON.parse(await readFile(join(fixtureRoot, "neonix-native-benchmark-fixtures.json"), "utf8")) as {
    composition: { width: number; height: number; fps: number };
    fixtures: Array<{ id: string; source: string; durationMs: number }>;
  };
  const fixture = manifest.fixtures.find((item) => item.id === fixtureId);
  if (!fixture) throw new Error(`Fixture not found: ${fixtureId}`);
  const html = await readFile(join(fixtureRoot, fixture.source), "utf8");
  const compiled = compileDocument(
    { html, fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS },
    { composition: { durationMs: fixture.durationMs, id: fixture.id } },
  );
  const errors = compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (compiled.status !== "success" || !compiled.protocol || errors.length > 0) {
    throw new Error(`Fixture compilation failed: ${compiled.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join(" | ")}`);
  }
  const runtime = await compileAndPrepareRuntimeProjectV3(compiled.protocol);
  if (runtime.visual.composition.width !== manifest.composition.width
    || runtime.visual.composition.height !== manifest.composition.height
    || runtime.visual.composition.fps !== manifest.composition.fps) {
    throw new Error("Fixture composition does not match the native benchmark contract");
  }

  const db = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const baseRef = required("NATIVE_E2E_BASE_PUBLIC_REF");
  const base = await db.from("render_jobs")
    .select("workspace_id, project_id, revision_id, created_by")
    .eq("public_ref", baseRef)
    .single();
  if (base.error || !base.data) throw new Error(`Base job lookup failed: ${base.error?.message ?? "missing"}`);

  const jobId = `rnd_native_e2e_${Date.now().toString(36)}`;
  const inserted = await db.from("render_jobs").insert({
    public_ref: jobId,
    workspace_id: base.data.workspace_id,
    project_id: base.data.project_id,
    revision_id: base.data.revision_id,
    status: "queued",
    preset_json: { preset: "export-1080p", projectRevision: 1, fixtureId },
    idempotency_key: `native-e2e-${jobId}`,
    provider_render_id: jobId,
    runtime_json: runtime,
    output_key: `native-e2e/${jobId}.mp4`,
    progress: 0,
    stage: "queued",
    metrics_json: { fixtureId, nativeBackend: "skia-native-raster" },
    attempt_count: 0,
    cancel_requested: false,
    created_by: base.data.created_by,
  }).select("public_ref").single();
  if (inserted.error || !inserted.data) throw new Error(`E2E job insert failed: ${inserted.error?.message ?? "no row returned"}`);
  console.log(JSON.stringify({
    jobId,
    fixtureId,
    durationSeconds: runtime.visual.composition.duration,
    frames: Math.ceil((runtime.visual.composition.duration ?? 1) * runtime.visual.composition.fps),
    outputKey: `native-e2e/${jobId}.mp4`,
  }));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
