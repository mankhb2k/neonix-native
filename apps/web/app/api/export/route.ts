import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseMotionProject } from "@motionvideo/motion-schema";
import { validateMotionProjectPresets } from "@motionvideo/motion-compiler";

export const runtime = "nodejs";
export const maxDuration = 120;

function repoRoot(): string {
  // next dev cwd is usually apps/web
  const cwd = process.cwd();
  if (cwd.replace(/\\/g, "/").endsWith("/apps/web")) {
    return path.resolve(cwd, "../..");
  }
  return cwd;
}

function runCliExport(mtPath: string): Promise<{
  ok: boolean;
  mp4Path?: string;
  error?: string;
}> {
  const root = repoRoot();
  const workerDir = path.join(root, "apps/render-worker");
  const tsxBin = path.join(root, "node_modules/.bin/tsx");
  const script = path.join(workerDir, "src/cli-export.ts");

  return new Promise((resolve) => {
    const child = spawn(tsxBin, [script, mtPath], {
      cwd: workerDir,
      env: process.env,
      shell: process.platform === "win32",
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      resolve({ ok: false, error: err.message });
    });
    child.on("close", (code) => {
      const lines = stdout
        .trim()
        .split("\n")
        .filter(Boolean);
      const last = lines[lines.length - 1];
      try {
        const parsed = JSON.parse(last ?? "{}") as {
          ok?: boolean;
          mp4Path?: string;
          error?: string;
        };
        if (parsed.ok && parsed.mp4Path) {
          resolve({ ok: true, mp4Path: parsed.mp4Path });
          return;
        }
        resolve({
          ok: false,
          error:
            parsed.error ||
            stderr.slice(-500) ||
            `cli-export exited ${code}`,
        });
      } catch {
        resolve({
          ok: false,
          error: stderr.slice(-500) || stdout.slice(-500) || `cli-export exited ${code}`,
        });
      }
    });
  });
}

/** POST MotionProject JSON → MP4 binary (local render via render-worker CLI). */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let project;
  try {
    project = parseMotionProject(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid Motion project";
    return Response.json({ error: message }, { status: 400 });
  }

  const presetCheck = validateMotionProjectPresets(project);
  if (!presetCheck.ok) {
    const detail = presetCheck.unknown
      .map((u) => `${u.sceneId}/${u.nodeId}:${u.preset}`)
      .join(", ");
    return Response.json(
      { error: `Unknown animation presets: ${detail}` },
      { status: 400 },
    );
  }

  const root = repoRoot();
  const tmpDir = path.join(root, "tmp", "api-export");
  await mkdir(tmpDir, { recursive: true });
  const mtPath = path.join(tmpDir, `${project.metadata.id}.mt`);
  await writeFile(mtPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");

  const result = await runCliExport(mtPath);
  if (!result.ok || !result.mp4Path) {
    return Response.json(
      { error: result.error ?? "Export failed" },
      { status: 500 },
    );
  }

  const bytes = await readFile(result.mp4Path);
  const filename = `${project.metadata.brand.name.replace(/[^\w-]+/g, "_") || "motion"}.mp4`;
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
