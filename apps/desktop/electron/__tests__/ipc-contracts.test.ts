import { describe, expect, it } from "vitest";
import { INVOKE_CHANNELS, IpcChannels } from "../../shared/ipc/channels";
import {
  DesktopIpcError,
  DesktopIpcErrorCode,
  desktopIpcErrorFromUnknown,
  ipcErr,
  ipcOk,
  isDesktopIpcErrorPayload,
  isIpcResult,
  serializeDesktopIpcError,
  unwrapIpcResult,
} from "../../shared/ipc/errors";
import {
  cancelExportSchema,
  confirmCloseSchema,
  emptyPayloadSchema,
  importFilesSchema,
  listMissingAssetsSchema,
  relinkAssetSchema,
  resolveAssetSchema,
  startExportSchema,
} from "../../shared/ipc/schemas";

describe("IpcChannels", () => {
  it("has unique channel string values", () => {
    const values = Object.values(IpcChannels);
    expect(new Set(values).size).toBe(values.length);
  });

  it("INVOKE_CHANNELS includes project.new and openRecent", () => {
    expect(INVOKE_CHANNELS).toContain(IpcChannels.projectNew);
    expect(INVOKE_CHANNELS).toContain(IpcChannels.projectOpenRecent);
    expect(INVOKE_CHANNELS).toContain(IpcChannels.assetsListMissing);
  });
});

describe("IPC schemas", () => {
  it("accepts empty invoke payloads", () => {
    expect(emptyPayloadSchema.safeParse(undefined).success).toBe(true);
    expect(emptyPayloadSchema.safeParse(null).success).toBe(true);
  });

  it("rejects invalid confirmClose payloads", () => {
    expect(confirmCloseSchema.safeParse({ ok: "yes" }).success).toBe(false);
    expect(confirmCloseSchema.safeParse({}).success).toBe(false);
    expect(confirmCloseSchema.safeParse({ ok: true }).success).toBe(true);
  });

  it("validates export start/cancel payloads", () => {
    expect(
      startExportSchema.safeParse({ projectId: "p1" }).success,
    ).toBe(false);
    expect(
      startExportSchema.safeParse({
        projectId: "p1",
        projectJson: "{}",
      }).success,
    ).toBe(true);
    expect(
      startExportSchema.safeParse({
        projectId: "p1",
        projectJson: "{}",
        overwrite: true,
      }).success,
    ).toBe(true);
    expect(
      startExportSchema.safeParse({
        projectId: "p1",
        projectJson: "{}",
        outputPath: "/tmp/out.mp4",
      }).success,
    ).toBe(false);
    expect(startExportSchema.safeParse({}).success).toBe(false);
    expect(cancelExportSchema.safeParse({ jobId: "j1" }).success).toBe(true);
  });

  it("validates assets import/resolve/relink/listMissing", () => {
    expect(importFilesSchema.safeParse(undefined).success).toBe(true);
    expect(
      resolveAssetSchema.safeParse({
        assetId: "asset_1",
        uri: "assets/x.png",
      }).success,
    ).toBe(true);
    expect(
      resolveAssetSchema.safeParse({
        projectPath: "/p/a.mt",
        assetId: "asset_1",
        uri: "assets/x.png",
      }).success,
    ).toBe(false);
    expect(
      relinkAssetSchema.safeParse({
        assetId: "asset_1",
      }).success,
    ).toBe(true);
    expect(
      listMissingAssetsSchema.safeParse({
        assets: [{ id: "a", uri: "assets/x.png" }],
      }).success,
    ).toBe(true);
  });
});

describe("DesktopIpcError", () => {
  it("serializes and detects structured payloads", () => {
    const error = new DesktopIpcError(
      DesktopIpcErrorCode.VALIDATION,
      "bad",
      { field: "ok" },
    );
    const payload = serializeDesktopIpcError(error);
    expect(isDesktopIpcErrorPayload(payload)).toBe(true);
    expect(payload.code).toBe("VALIDATION");

    const restored = desktopIpcErrorFromUnknown(payload);
    expect(restored).toBeInstanceOf(DesktopIpcError);
    expect(restored.code).toBe(DesktopIpcErrorCode.VALIDATION);
  });

  it("maps Error with code into DesktopIpcError", () => {
    const err = Object.assign(new Error("not yet"), {
      code: DesktopIpcErrorCode.NOT_IMPLEMENTED,
    });
    const restored = desktopIpcErrorFromUnknown(err);
    expect(restored.code).toBe(DesktopIpcErrorCode.NOT_IMPLEMENTED);
  });

  it("includes Phase 4 file error codes", () => {
    expect(DesktopIpcErrorCode.CORRUPT_FILE).toBe("CORRUPT_FILE");
    expect(DesktopIpcErrorCode.UNSUPPORTED_VERSION).toBe("UNSUPPORTED_VERSION");
    expect(DesktopIpcErrorCode.SAVE_FAILED).toBe("SAVE_FAILED");
    expect(DesktopIpcErrorCode.CANCELLED).toBe("CANCELLED");
  });

  it("includes Phase 7 asset error codes", () => {
    expect(DesktopIpcErrorCode.MISSING_ASSET).toBe("MISSING_ASSET");
    expect(DesktopIpcErrorCode.PATH_DENIED).toBe("PATH_DENIED");
  });

  it("unwraps IpcResult envelopes (Electron-safe)", () => {
    const ok = ipcOk({ n: 1 });
    expect(unwrapIpcResult(ok)).toEqual({ n: 1 });

    const err = ipcErr(
      new DesktopIpcError(DesktopIpcErrorCode.CANCELLED, "cancelled"),
    );
    expect(isIpcResult(err)).toBe(true);
    try {
      unwrapIpcResult(err);
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(DesktopIpcError);
      expect((error as DesktopIpcError).code).toBe(
        DesktopIpcErrorCode.CANCELLED,
      );
    }
  });
});
