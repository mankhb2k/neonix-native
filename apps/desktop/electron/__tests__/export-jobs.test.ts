import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { DesktopIpcError, DesktopIpcErrorCode } from "../../shared/ipc/errors";
import type { ExportEvent } from "../../shared/ipc/contracts";
import { createExportService } from "../main/services/export-service";
import {
  createExportProcessManager,
  type SpawnFn,
} from "../main/utility-processes/export-process-manager";

describe("export-service path policy", () => {
  it("denies overwrite when file exists and overwrite is false", async () => {
    const events: ExportEvent[] = [];
    const files = new Set<string>(["D:\\out\\exists.mp4"]);
    const service = createExportService({
      repoRoot: "D:\\repo",
      emit: (e) => events.push(e),
      fs: {
        existsSync: (p) => files.has(p.replace(/\//g, "\\")) || files.has(p),
        mkdirSync: () => undefined,
        writeFileSync: () => undefined,
        rmSync: () => undefined,
      },
      createJobId: () => "export_test",
      processManager: {
        startJob: async () => ({ ok: true, mp4Path: "D:\\out\\exists.mp4" }),
        cancel: () => false,
        disposeAll: () => undefined,
        isActive: () => false,
      },
    });

    await expect(
      service.start(
        {
          projectId: "p1",
          projectJson: JSON.stringify({ metadata: { id: "p1" } }),
          outputPath: "D:\\out\\exists.mp4",
          overwrite: false,
        },
        null,
      ),
    ).rejects.toMatchObject({
      code: DesktopIpcErrorCode.OUTPUT_DENIED,
    });
  });

  it("returns jobId before any progress events", async () => {
    const events: ExportEvent[] = [];
    let resolveStart!: (v: { ok: true; mp4Path: string }) => void;
    const started = new Promise<{ ok: true; mp4Path: string }>((r) => {
      resolveStart = r;
    });

    const service = createExportService({
      repoRoot: "D:\\repo",
      timeoutMs: 5_000,
      emit: (e) => events.push(e),
      createJobId: () => "export_race",
      fs: {
        existsSync: () => false,
        mkdirSync: () => undefined,
        writeFileSync: () => undefined,
        rmSync: () => undefined,
      },
      processManager: {
        startJob: async () => started,
        cancel: () => true,
        disposeAll: () => undefined,
        isActive: () => false,
      },
    });

    const job = await service.start(
      {
        projectId: "p1",
        projectJson: JSON.stringify({ metadata: { id: "p1" } }),
        outputPath: "D:\\out\\race.mp4",
        overwrite: true,
      },
      null,
    );
    expect(job.id).toBe("export_race");
    expect(events).toEqual([]);

    resolveStart({ ok: true, mp4Path: "D:\\out\\race.mp4" });
    await vi.waitFor(() => {
      expect(events.some((e) => e.type === "completed")).toBe(true);
    });
  });

  it("starts a job and emits completed after mock CLI", async () => {
    const events: ExportEvent[] = [];
    const written: string[] = [];
    const service = createExportService({
      repoRoot: "D:\\repo",
      timeoutMs: 5_000,
      emit: (e) => events.push(e),
      createJobId: () => "export_ok",
      fs: {
        existsSync: () => false,
        mkdirSync: () => undefined,
        writeFileSync: (p) => {
          written.push(p);
        },
        rmSync: () => undefined,
      },
      processManager: {
        startJob: async () => ({
          ok: true,
          mp4Path: "D:\\out\\final.mp4",
        }),
        cancel: () => true,
        disposeAll: () => undefined,
        isActive: () => false,
      },
    });

    const job = await service.start(
      {
        projectId: "p1",
        projectJson: JSON.stringify({ metadata: { id: "p1" } }),
        outputPath: "D:\\out\\final.mp4",
        overwrite: true,
      },
      null,
    );
    expect(job.id).toBe("export_ok");
    expect(written.length).toBeGreaterThan(0);

    await vi.waitFor(() => {
      expect(events.some((e) => e.type === "completed")).toBe(true);
    });
    const done = events.find((e) => e.type === "completed");
    expect(done).toMatchObject({
      type: "completed",
      outputPath: "D:\\out\\final.mp4",
    });
    expect(done && "sequence" in done && done.sequence).toBeGreaterThan(0);
  });
});

describe("export-process-manager packaged", () => {
  it("fails clearly when packaged CLI is missing", async () => {
    const manager = createExportProcessManager({ packaged: true });
    const result = await manager.startJob({
      jobId: "missing-cli",
      projectJsonPath: "/tmp/p.json",
      outDir: "/tmp/out",
      assetBaseDir: "/tmp/assets",
      outputPath: "/tmp/out.mp4",
      repoRoot: "/tmp/empty-resources",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Packaged export CLI missing/);
      expect(result.error).not.toMatch(/tsx/i);
    }
  });
});

describe("export-process-manager cancel", () => {
  it("marks job cancelled and kills child", async () => {
    const child = new EventEmitter() as EventEmitter & {
      pid: number;
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: ReturnType<typeof vi.fn>;
    };
    child.pid = 4242;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();

    const spawnFn = vi.fn(() => child) as unknown as SpawnFn;
    const manager = createExportProcessManager({ spawnFn });

    const resultPromise = manager.startJob({
      jobId: "j1",
      projectJsonPath: "/tmp/p.json",
      outDir: "/tmp/out",
      assetBaseDir: "/tmp/assets",
      outputPath: "/tmp/out.mp4",
      repoRoot: "/repo",
    });

    expect(manager.isActive("j1")).toBe(true);
    expect(manager.cancel("j1")).toBe(true);
    child.emit("close", 1);

    const result = await resultPromise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("cancelled");
  });
});

describe("DesktopIpcError export codes", () => {
  it("includes EXPORT_FAILED and OUTPUT_DENIED", () => {
    expect(DesktopIpcErrorCode.EXPORT_FAILED).toBe("EXPORT_FAILED");
    expect(DesktopIpcErrorCode.OUTPUT_DENIED).toBe("OUTPUT_DENIED");
    const err = new DesktopIpcError(
      DesktopIpcErrorCode.EXPORT_FAILED,
      "boom",
    );
    expect(err.code).toBe("EXPORT_FAILED");
  });
});
