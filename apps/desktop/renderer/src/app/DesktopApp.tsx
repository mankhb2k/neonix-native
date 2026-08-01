import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { DesktopIpcError, DesktopIpcErrorCode } from "../../../src/shared/ipc/errors";
import { createProjectRepository } from "../infrastructure/repositories/project-repository";
import { ErrorBoundary } from "./error-boundary/ErrorBoundary";
import { seedProductionUi, uiFixturesEnabled } from "./fixtures/seed-production-ui";
import { readUiFixtureId } from "./fixtures/ui-fixture";
import { HubScreen } from "./hub/HubScreen";
import { TitleBar } from "./shell/TitleBar";
import {
  createInitialAppState,
  reduceAppState,
} from "./state/app-machine";
import type { EditorSessionHandle } from "./editor/editor-session-handle";
import type { DesktopAPI } from "../../../src/shared/ipc/contracts";

const JOURNAL_AUTOSAVE_MAX_MS = 45_000;
const JOURNAL_AUTOSAVE_IDLE_MS = 3_000;

const DiagnosticsScreen = lazy(() =>
  import("./diagnostics/DiagnosticsScreen").then((m) => ({
    default: m.DiagnosticsScreen,
  })),
);
const UiGallery = lazy(() =>
  import("./gallery/UiGallery").then((m) => ({ default: m.UiGallery })),
);
const EditingWorkspace = lazy(() =>
  import("./editor/EditingWorkspace").then((m) => ({
    default: m.EditingWorkspace,
  })),
);

type Props = {
  api: DesktopAPI;
};

function errorMessage(err: unknown): string {
  if (err instanceof DesktopIpcError) {
    if (err.code === DesktopIpcErrorCode.CANCELLED) return "";
    return `${err.code}: ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export function DesktopApp({ api }: Props) {
  const [state, dispatch] = useReducer(reduceAppState, undefined, createInitialAppState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const sessionHandleRef = useRef<EditorSessionHandle | null>(null);
  const journalEpochRef = useRef(0);
  const idleAutosaveTimerRef = useRef<number | null>(null);
  const repo = useMemo(() => createProjectRepository(api), [api]);

  const bumpJournalEpoch = useCallback(() => {
    journalEpochRef.current += 1;
    if (idleAutosaveTimerRef.current != null) {
      window.clearTimeout(idleAutosaveTimerRef.current);
      idleAutosaveTimerRef.current = null;
    }
  }, []);

  const runAutosave = useCallback(
    (reason: "idle" | "max") => {
      if (uiFixturesEnabled()) return;
      const cur = stateRef.current;
      if (cur.phase === "saving") return;
      if (!cur.dirty || !cur.documentJson || !cur.projectId) return;
      const epoch = journalEpochRef.current;
      void api.journal
        .autosave({
          projectId: cur.projectId,
          documentJson: cur.documentJson,
        })
        .then(() => {
          if (journalEpochRef.current !== epoch) return;
        })
        .catch((err: unknown) => {
          // Best-effort diagnostics; journal must not throw into the UI loop.
          // eslint-disable-next-line no-console -- intentional autosave failure visibility
          console.warn(`[journal] autosave (${reason}) failed`, err);
        });
    },
    [api],
  );

  const scheduleIdleAutosave = useCallback(() => {
    if (uiFixturesEnabled()) return;
    if (idleAutosaveTimerRef.current != null) {
      window.clearTimeout(idleAutosaveTimerRef.current);
    }
    idleAutosaveTimerRef.current = window.setTimeout(() => {
      idleAutosaveTimerRef.current = null;
      runAutosave("idle");
    }, JOURNAL_AUTOSAVE_IDLE_MS);
  }, [runAutosave]);

  useEffect(() => {
    let cancelled = false;
    const fixtureId = uiFixturesEnabled() ? readUiFixtureId() : null;
    if (fixtureId) {
      const seed = seedProductionUi(fixtureId);
      if (seed.kind === "hub") {
        dispatch({ type: "BOOT_DONE", recent: seed.recent });
      } else {
        dispatch({
          type: "NEW_PROJECT",
          projectId: seed.projectId,
          documentJson: seed.documentJson,
          name: seed.projectName,
        });
      }
      return () => {
        cancelled = true;
      };
    }
    void repo
      .getRecent()
      .then((recent) => {
        if (!cancelled) dispatch({ type: "BOOT_DONE", recent });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          dispatch({
            type: "BOOT_ERROR",
            message: errorMessage(err) || "Failed to load recent projects.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  const refreshRecent = useCallback(async () => {
    try {
      const recent = await repo.getRecent();
      dispatch({ type: "SET_RECENT", recent });
      return recent;
    } catch {
      return stateRef.current.recent;
    }
  }, [repo]);

  const performSave = useCallback(
    async (snapshot?: {
      documentJson: string;
      projectName?: string;
    }): Promise<boolean> => {
      const current = stateRef.current;
      const json = snapshot?.documentJson ?? current.documentJson;
      const suggestedName = snapshot?.projectName ?? current.projectName;
      if (!json) return false;
      bumpJournalEpoch();
      dispatch({ type: "SAVE_START" });
      try {
        const result = current.path
          ? await repo.save({ documentJson: json })
          : await repo.saveAs({
              suggestedName,
              documentJson: json,
            });
        dispatch({
          type: "SAVE_SUCCESS",
          path: result.path,
          documentJson: json,
        });
        await refreshRecent();
        return true;
      } catch (err) {
        const message = errorMessage(err);
        if (!message) {
          dispatch({ type: "SAVE_CANCEL" });
          return false;
        }
        dispatch({ type: "SAVE_ERROR", message });
        return false;
      }
    },
    [repo, refreshRecent, bumpJournalEpoch],
  );

  useEffect(() => {
    return api.window.onRequestCloseSave(() => {
      const handle = sessionHandleRef.current;
      const snap = handle?.flushSnapshot();
      const dirty = snap?.dirty ?? stateRef.current.dirty;
      if (!dirty) {
        void api.window.confirmClose(true);
        return;
      }
      const choice = window.confirm(
        "You have unsaved changes.\n\nOK = Save and close\nCancel = Stay open",
      );
      if (!choice) {
        void api.window.confirmClose(false);
        return;
      }
      void (async () => {
        const saved = await performSave(
          snap
            ? { documentJson: snap.documentJson, projectName: snap.projectName }
            : undefined,
        );
        void api.window.confirmClose(saved);
      })();
    });
  }, [api, performSave]);

  // Crash-recovery: idle (3s) + max interval (45s) full snapshots when dirty.
  useEffect(() => {
    if (uiFixturesEnabled()) return undefined;
    if (state.phase !== "editing") return undefined;
    if (!state.dirty || !state.projectId) return undefined;

    scheduleIdleAutosave();
    const maxTimer = window.setInterval(() => {
      runAutosave("max");
    }, JOURNAL_AUTOSAVE_MAX_MS);
    return () => {
      window.clearInterval(maxTimer);
      if (idleAutosaveTimerRef.current != null) {
        window.clearTimeout(idleAutosaveTimerRef.current);
        idleAutosaveTimerRef.current = null;
      }
    };
  }, [
    api,
    state.phase,
    state.dirty,
    state.projectId,
    state.documentJson,
    scheduleIdleAutosave,
    runAutosave,
  ]);

  const onNew = useCallback(
    async (
      input?: import("../../../src/shared/ipc/contracts").CreateProjectInput,
    ): Promise<boolean> => {
      try {
        const blank = await repo.newProject(input);
        dispatch({
          type: "NEW_PROJECT",
          projectId: blank.projectId,
          documentJson: blank.documentJson,
          name: blank.name,
        });
        return true;
      } catch (err) {
        dispatch({ type: "OPEN_ERROR", message: errorMessage(err) });
        return false;
      }
    },
    [repo],
  );

  const onOpen = useCallback(async () => {
    dispatch({ type: "OPEN_START" });
    try {
      const opened = await repo.open();
      if (!opened) {
        dispatch({ type: "OPEN_CANCEL" });
        return;
      }
      dispatch({
        type: "OPEN_SUCCESS",
        path: opened.path,
        projectId: opened.projectId,
        documentJson: opened.documentJson,
      });
      await refreshRecent();
    } catch (err) {
      dispatch({ type: "OPEN_ERROR", message: errorMessage(err) });
    }
  }, [repo, refreshRecent]);

  const onOpenRecent = useCallback(
    async (item: { id: string }) => {
      dispatch({ type: "OPEN_START" });
      try {
        const opened = await repo.openRecent(item.id);
        dispatch({
          type: "OPEN_SUCCESS",
          path: opened.path,
          projectId: opened.projectId,
          documentJson: opened.documentJson,
        });
        await refreshRecent();
      } catch (err) {
        dispatch({ type: "OPEN_ERROR", message: errorMessage(err) });
      }
    },
    [repo, refreshRecent],
  );

  const onSaveAs = useCallback(
    async (snapshot?: { documentJson: string; projectName?: string }) => {
      const current = stateRef.current;
      const json = snapshot?.documentJson ?? current.documentJson;
      const suggestedName = snapshot?.projectName ?? current.projectName;
      if (!json) return;
      bumpJournalEpoch();
      dispatch({ type: "SAVE_START" });
      try {
        const result = await repo.saveAs({
          suggestedName,
          documentJson: json,
        });
        dispatch({
          type: "SAVE_SUCCESS",
          path: result.path,
          documentJson: json,
        });
        await refreshRecent();
      } catch (err) {
        const message = errorMessage(err);
        if (!message) dispatch({ type: "SAVE_CANCEL" });
        else dispatch({ type: "SAVE_ERROR", message });
      }
    },
    [repo, refreshRecent, bumpJournalEpoch],
  );

  const onCloseToHome = useCallback(async () => {
    const snap = sessionHandleRef.current?.flushSnapshot();
    const dirty = snap?.dirty ?? stateRef.current.dirty;
    if (dirty) {
      const leave = window.confirm(
        "Discard unsaved changes and return to Home?",
      );
      if (!leave) return;
      bumpJournalEpoch();
      const projectId = stateRef.current.projectId;
      if (projectId) {
        try {
          await api.journal.discard({ projectId });
        } catch {
          /* discard is best-effort before leaving */
        }
      }
    }
    const recent = await refreshRecent();
    dispatch({ type: "GO_HOME", recent });
  }, [api, refreshRecent, bumpJournalEpoch]);

  const title =
    state.phase === "editing" || state.phase === "saving"
      ? state.projectName
      : "MotionVideo";

  const showGallery =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    (window.location.search.includes("gallery=1") ||
      window.location.hash === "#gallery");
  const uiFixture = uiFixturesEnabled() ? readUiFixtureId() : null;
  const fixtureSeed =
    uiFixture && uiFixturesEnabled() ? seedProductionUi(uiFixture) : null;
  const appReady =
    state.phase !== "booting" &&
    (uiFixture
      ? state.phase === "home" || state.phase === "editing"
      : true);

  return (
    <ErrorBoundary>
      <div
        className="app-shell"
        data-app-ready={appReady ? "true" : "false"}
        data-ui-fixture={uiFixture ?? undefined}
      >
        <TitleBar api={api} title={title} dirty={state.dirty} />
        {showGallery ? (
          <Suspense fallback={<p className="home__muted">Loading gallery…</p>}>
            <UiGallery
              onClose={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete("gallery");
                url.hash = "";
                window.history.replaceState({}, "", url.toString());
                window.location.reload();
              }}
            />
          </Suspense>
        ) : null}
        {!showGallery && state.showDiagnostics ? (
          <Suspense fallback={<p className="home__muted">Loading diagnostics…</p>}>
            <DiagnosticsScreen
              api={api}
              onBack={() => dispatch({ type: "SHOW_DIAGNOSTICS", show: false })}
            />
          </Suspense>
        ) : null}
        {!showGallery &&
        !state.showDiagnostics &&
        (state.phase === "booting" || state.phase === "error") ? (
          <main className="home">
            {state.phase === "booting" ? (
              <p className="home__muted">Starting…</p>
            ) : (
              <p className="home__error">{state.error}</p>
            )}
          </main>
        ) : null}
        {!showGallery &&
        !state.showDiagnostics &&
        (state.phase === "home" ||
          state.phase === "opening" ||
          (state.phase === "editing" && !state.documentJson)) ? (
          <HubScreen
            recent={state.recent}
            error={state.error}
            busy={state.phase === "opening"}
            onNew={onNew}
            onOpen={() => void onOpen()}
            onOpenRecent={(item) => void onOpenRecent(item)}
            onDiagnostics={() =>
              dispatch({ type: "SHOW_DIAGNOSTICS", show: true })
            }
            onClearError={() => dispatch({ type: "CLEAR_ERROR" })}
          />
        ) : null}
        {!showGallery &&
        !state.showDiagnostics &&
        state.documentJson &&
        (state.phase === "editing" || state.phase === "saving") ? (
          <Suspense fallback={<p className="home__muted">Loading editor…</p>}>
            <EditingWorkspace
              api={api}
              projectId={state.projectId ?? "untitled"}
              path={state.path}
              documentJson={state.documentJson}
              dirty={state.dirty}
              error={state.error}
              saving={state.phase === "saving"}
              sessionHandleRef={sessionHandleRef}
              initialSidebarTab={
                fixtureSeed?.kind === "editor"
                  ? fixtureSeed.initialSidebarTab
                  : undefined
              }
              timelineFocus={
                fixtureSeed?.kind === "editor"
                  ? fixtureSeed.timelineFocus
                  : undefined
              }
              onDocumentChange={(documentJson) => {
                dispatch({ type: "SET_DOCUMENT_JSON", documentJson });
              }}
              onSave={(snapshot) => void performSave(snapshot)}
              onSaveAs={(snapshot) => void onSaveAs(snapshot)}
              onCloseToHome={() => void onCloseToHome()}
              onClearError={() => dispatch({ type: "CLEAR_ERROR" })}
            />
          </Suspense>
        ) : null}
      </div>
    </ErrorBoundary>
  );
}
