import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseCreativeBriefV1,
  runScopedRefine,
  runZeroTemplateGeneration,
  type OrchestratorProgress,
} from "@motionvideo/ai-planner";
import {
  migrateMotionProjectV2ToV3,
  parseMotionProject,
  type MotionProjectV3,
} from "@motionvideo/motion-protocol";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * Phase 3 boundary: the AI planner still authors v2 projects internally
 * (its executor cutover is a later phase). Web consumers parse v3 only, so
 * migrate the AI output to v3 here before it leaves the route.
 */
function toV3Project(project: unknown): MotionProjectV3 {
  return migrateMotionProjectV2ToV3(project as never).project;
}

function repoRoot(): string {
  const cwd = process.cwd();
  if (cwd.replace(/\\/g, "/").endsWith("/apps/web")) {
    return path.resolve(cwd, "../..");
  }
  return cwd;
}

type GenerationBody = {
  brief?: unknown;
  prompt?: string;
  seed?: string;
  industry?: string;
  mode?: "generate" | "refine";
  scope?: string;
  baseRevision?: number;
  selectionKey?: string;
  project?: unknown;
  probeFrames?: boolean;
  stream?: boolean;
};

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function persistTrace(
  result: Awaited<ReturnType<typeof runZeroTemplateGeneration>>,
): Promise<string> {
  const root = repoRoot();
  const dir = path.join(root, "tmp", "ai-generations", result.generation.seed);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "trace.json"),
    JSON.stringify(
      {
        generation: result.generation,
        ok: result.ok,
        critic: result.critic,
        contactSheet: result.contactSheet,
        probe: result.probe,
        repairs: result.repairs,
        modelRepairs: result.modelRepairs,
        receipts: result.receipts,
        brief: result.brief,
        plan: result.plan,
        sceneDesign: result.sceneDesign,
        error: result.error,
      },
      null,
      2,
    ),
    "utf8",
  );
  if (result.project) {
    await writeFile(
      path.join(dir, "project.mt.json"),
      JSON.stringify(result.project, null, 2),
      "utf8",
    );
  }
  return dir;
}

async function handleGenerate(
  body: GenerationBody,
  onProgress?: (p: OrchestratorProgress) => void,
) {
  let brief = body.brief;
  if (!brief && body.prompt) {
    brief = {
      format: "moticlip-creative-brief",
      formatVersion: 1,
      objective: body.prompt.slice(0, 120),
      durationSeconds: 12,
      aspectRatio: "9:16",
      script: body.prompt,
      language: "vi",
      brand: { name: "MotiClip", primaryColor: "#f97316" },
      constraints: { maxScenes: 3, mustIncludeCta: true },
    };
  }
  parseCreativeBriefV1(brief);
  const result = await runZeroTemplateGeneration({
    brief,
    seed: body.seed,
    industry: body.industry,
    maxModelRepairs: 2,
    probeFrames: body.probeFrames ?? false,
    onProgress,
  });
  const traceDir = await persistTrace(result);
  return { ...result, traceDir };
}

async function handleRefine(body: GenerationBody) {
  if (!body.project) {
    throw new Error("refine requires project");
  }
  const project = parseMotionProject(body.project);
  const result = await runScopedRefine({
    project,
    prompt: body.prompt ?? "",
    scope: body.scope ?? "element",
    baseRevision: body.baseRevision ?? 0,
    selectionKey: body.selectionKey,
  });
  return { ...result, project: toV3Project(result.project) };
}

/** POST /api/ai/generations — zero-template generation or scoped refine (SSE optional). */
export async function POST(request: Request): Promise<Response> {
  let body: GenerationBody;
  try {
    body = (await request.json()) as GenerationBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const wantStream = body.stream !== false && body.mode !== "refine";

  if (body.mode === "refine") {
    try {
      const result = await handleRefine(body);
      return Response.json({
        ok: result.ok,
        project: result.project,
        revision: result.revision,
        receipts: result.receipts,
        summary: result.summary,
        commandLabels: result.commandLabels,
        batch: {
          format: "moticlip-command-batch",
          formatVersion: 1,
          baseRevision: body.baseRevision ?? 0,
          commands: result.receipts.length ? undefined : undefined,
        },
        proposal: {
          id: `prop_${Date.now().toString(36)}`,
          baseRevision: body.baseRevision ?? 0,
          scope: body.scope ?? "element",
          summary: result.summary,
          affectedElementKeys: body.selectionKey
            ? [body.selectionKey]
            : [`scope:${body.scope ?? "video"}`],
          warnings: result.receipts.flatMap((r) =>
            r.diagnostics
              .filter((d) => d.severity === "warning")
              .map((d) => d.message),
          ),
          commandLabels: result.commandLabels,
          project: result.project,
          revision: result.revision,
        },
      });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }
  }

  if (wantStream) {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(sseEncode(event, data)));
        };
        try {
          send("phase", { phase: "queued", progress: 5 });
          const result = await handleGenerate(body, (p) => send("phase", p));
          send("result", {
            ok: result.ok,
            project: result.project,
            critic: result.critic,
            generation: result.generation,
            traceDir: result.traceDir,
            repairs: result.repairs,
            modelRepairs: result.modelRepairs,
            contactSheet: result.contactSheet,
            error: result.error,
            proposal: result.project
              ? {
                  id: `prop_${result.generation.seed}`,
                  baseRevision: body.baseRevision ?? 0,
                  scope: "video",
                  summary: `Zero-template draft: ${result.brief.objective.slice(0, 80)}`,
                  affectedElementKeys: result.project.scenes.flatMap((s) =>
                    s.nodes.map((n) => `${s.id}/${n.id}`),
                  ),
                  warnings: result.critic.findings
                    .filter((f) => f.severity === "warning")
                    .map((f) => f.message),
                  commandLabels: result.receipts.map((r) => `rev${r.revision}`),
                  project: result.project,
                  revision: result.receipts.at(-1)?.revision ?? 1,
                  generation: {
                    ...result.generation,
                    criticScore: result.critic.score,
                    warnings: result.critic.findings
                      .filter((f) => f.severity === "warning")
                      .map((f) => f.message),
                  },
                }
              : null,
          });
          send("done", { ok: result.ok });
        } catch (error) {
          send("error", {
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  try {
    const result = await handleGenerate(body);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
