/**
 * Packaged-app probe for journal validate worker.
 * Triggered only when MOTIONVIDEO_JOURNAL_WORKER_SMOKE=1 and a harness token is set.
 * Report path is forced under Electron temp (harness may pass a temp filename/path).
 */
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { buildBlankDesktopProject } from "../../../../shared/project-file/envelope";
import {
  JOURNAL_VALIDATE_OFFLOAD_BYTES,
  resolveJournalValidateWorkerPath,
  validateAndHashDocument,
} from "../journal-validate/journal-document.validator";
import { resolveJournalWorkerSmokeOutPath } from "./journal-worker-smoke.path";

function inflateToBytes(base: string, targetBytes: number): string {
  const envelope = JSON.parse(base) as {
    project: {
      scenes: Array<Record<string, unknown>>;
      timeline: { audioTracks: unknown[] };
    };
  };
  const id = "scene_smoke_pad";
  const node = {
    id: "node_smoke_pad",
    type: "text",
    parentId: null,
    zIndex: 0,
    transform: {
      x: 1,
      y: 1,
      width: 10,
      height: 10,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      anchorX: 0.5,
      anchorY: 0.5,
      opacity: 1,
      visible: true,
      flipX: false,
      flipY: false,
    },
    payload: { text: "", fontSize: 12, fontWeight: 400, align: "left" },
  };
  envelope.project.scenes = [
    { id, name: "Smoke", duration: 1, nodes: [node], clips: [] },
  ];
  let json = JSON.stringify(envelope);
  const deficit = targetBytes - Buffer.byteLength(json, "utf8");
  if (deficit > 0) {
    (node.payload as { text: string }).text = "x".repeat(deficit);
    json = JSON.stringify(envelope);
  }
  return json;
}

export async function runJournalWorkerSmokeProbe(): Promise<number> {
  const outPath = resolveJournalWorkerSmokeOutPath({
    token: process.env.MOTIONVIDEO_JOURNAL_WORKER_SMOKE_TOKEN,
    requestedOut: process.env.MOTIONVIDEO_JOURNAL_WORKER_SMOKE_OUT,
    tempRoot: app.getPath("temp"),
  });
  if (!outPath) {
    console.error(
      "[journal-worker-smoke] refused: missing/invalid token or out path outside temp",
    );
    return 1;
  }

  const workerPath = resolveJournalValidateWorkerPath();
  const blank = buildBlankDesktopProject({ name: "PackagedSmoke" });
  const documentJson = inflateToBytes(
    blank.documentJson,
    JOURNAL_VALIDATE_OFFLOAD_BYTES + 64_000,
  );
  const bytes = Buffer.byteLength(documentJson, "utf8");

  const result = await validateAndHashDocument(documentJson, {
    offloadBytes: JOURNAL_VALIDATE_OFFLOAD_BYTES,
  });

  const payload = {
    ok: result.ok && result.via === "worker",
    packaged: app.isPackaged,
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    workerPath,
    workerExists: Boolean(workerPath && fs.existsSync(workerPath)),
    bytes,
    via: result.ok ? result.via : null,
    fallbackFrom: result.ok ? (result.fallbackFrom ?? null) : null,
    error: result.ok ? null : result.error,
    kind: result.ok ? null : result.kind,
    smokeTokenPresent: true,
    recordedAt: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.info("[journal-worker-smoke]", JSON.stringify(payload));

  return payload.ok ? 0 : 1;
}
