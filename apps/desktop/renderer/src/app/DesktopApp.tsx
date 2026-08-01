import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { DesktopIpcError, DesktopIpcErrorCode } from "../../../src/shared/ipc/errors";
import { createProjectRepository } from "../infrastructure/repositories/project-repository";
import { EditingWorkspace } from "./editor/EditingWorkspace";
import { ErrorBoundary } from "./error-boundary/ErrorBoundary";
import { HubScreen } from "./hub/HubScreen";
import { TitleBar } from "./shell/TitleBar";
import {
  createInitialAppState,
  reduceAppState,
} from "./state/app-machine";
import type { EditorSessionHandle } from "./editor/editor-session-handle";
import type { DesktopAPI } from "../../../src/shared/ipc/contracts";

const DiagnosticsScreen = lazy(() =>
  import("./diagnostics/DiagnosticsScreen").then((m) => ({
    default: m.DiagnosticsScreen,
  })),
);
const UiGallery = lazy(() =>
  import("./gallery/UiGallery").then((m) => ({ default: m.UiGallery })),
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
  const repo = useMemo(() => createProjectRepository(api), [api]);

  useEffect(() => {
    let cancelled = false;
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
    async (documentJson?: string): Promise<boolean> => {
      const current = stateRef.current;
      const json = documentJson ?? current.documentJson;
      if (!json) return false;
      dispatch({ type: "SAVE_START" });
      try {
        const result = current.path
          ? await repo.save({ documentJson: json })
          : await repo.saveAs({
              suggestedName: current.projectName,
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
    [repo, refreshRecent],
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
        const saved = await performSave(snap?.documentJson);
        void api.window.confirmClose(saved);
      })();
    });
  }, [api, performSave]);

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
    async (documentJson?: string) => {
      const current = stateRef.current;
      const json = documentJson ?? current.documentJson;
      if (!json) return;
      dispatch({ type: "SAVE_START" });
      try {
        const result = await repo.saveAs({
          suggestedName: current.projectName,
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
    [repo, refreshRecent],
  );

  const onCloseToHome = useCallback(async () => {
    const snap = sessionHandleRef.current?.flushSnapshot();
    const dirty = snap?.dirty ?? stateRef.current.dirty;
    if (dirty) {
      const leave = window.confirm(
        "Discard unsaved changes and return to Home?",
      );
      if (!leave) return;
    }
    const recent = await refreshRecent();
    dispatch({ type: "GO_HOME", recent });
  }, [refreshRecent]);

  const title =
    state.phase === "editing" || state.phase === "saving"
      ? state.projectName
      : "MotionVideo";

  const showGallery =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    (window.location.search.includes("gallery=1") ||
      window.location.hash === "#gallery");

  return (
    <ErrorBoundary>
      <div className="app-shell">
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
          <EditingWorkspace
            api={api}
            projectId={state.projectId ?? "untitled"}
            path={state.path}
            documentJson={state.documentJson}
            dirty={state.dirty}
            error={state.error}
            saving={state.phase === "saving"}
            sessionHandleRef={sessionHandleRef}
            onDocumentChange={(documentJson) =>
              dispatch({ type: "SET_DOCUMENT_JSON", documentJson })
            }
            onSave={(documentJson) => void performSave(documentJson)}
            onSaveAs={(documentJson) => void onSaveAs(documentJson)}
            onCloseToHome={() => void onCloseToHome()}
            onClearError={() => dispatch({ type: "CLEAR_ERROR" })}
          />
        ) : null}
      </div>
    </ErrorBoundary>
  );
}
