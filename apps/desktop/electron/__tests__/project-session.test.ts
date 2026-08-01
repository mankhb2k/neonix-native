import { describe, expect, it } from "vitest";
import {
  assertDocumentMatchesSession,
  assertSessionProjectId,
  clearProjectSession,
  getProjectSession,
  requireSavedProjectSession,
  setProjectSession,
} from "../main/services/project-session";
import { DesktopIpcError, DesktopIpcErrorCode } from "../../shared/ipc/errors";

describe("project-session", () => {
  it("allows unsaved sessions with null path", () => {
    clearProjectSession(1);
    setProjectSession(1, { path: null, projectId: "p-unsaved" });
    expect(getProjectSession(1)).toEqual({
      path: null,
      projectId: "p-unsaved",
    });
    expect(() => requireSavedProjectSession(1)).toThrow(DesktopIpcError);
    clearProjectSession(1);
  });

  it("rejects journal projectId that does not match session", () => {
    clearProjectSession(2);
    setProjectSession(2, { path: null, projectId: "bound" });
    expect(() =>
      assertSessionProjectId(getProjectSession(2), "other"),
    ).toThrowError(/does not match/);
    expect(() =>
      assertSessionProjectId(getProjectSession(2), "bound"),
    ).not.toThrow();
    try {
      assertSessionProjectId(null, "bound");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DesktopIpcError);
      expect((err as DesktopIpcError).code).toBe(
        DesktopIpcErrorCode.VALIDATION,
      );
    }
    clearProjectSession(2);
  });

  it("rejects document projectId that does not match session on save", () => {
    clearProjectSession(3);
    setProjectSession(3, { path: "/tmp/a.mt", projectId: "session-a" });
    expect(() =>
      assertDocumentMatchesSession(getProjectSession(3), "other-doc"),
    ).toThrowError(/Document projectId/);
    expect(() =>
      assertDocumentMatchesSession(getProjectSession(3), "session-a"),
    ).not.toThrow();
    expect(() =>
      assertDocumentMatchesSession(null, "anything"),
    ).not.toThrow();
    clearProjectSession(3);
  });
});
