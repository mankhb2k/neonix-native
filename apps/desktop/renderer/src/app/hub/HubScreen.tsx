import { useCallback, useState } from "react";
import { Button, Dialog, PanelHeader, Select } from "../../ui";
import { HubRecentGrid } from "./HubRecentGrid";
import { HubSidebar } from "./HubSidebar";
import type {
  CreateProjectInput,
  RecentProject,
} from "../../../../src/shared/ipc/contracts";

type Props = {
  recent: RecentProject[];
  error: string | null;
  busy?: boolean;
  onNew: (input: CreateProjectInput) => Promise<boolean>;
  onOpen: () => void;
  onOpenRecent: (item: RecentProject) => void;
  onDiagnostics: () => void;
  onClearError: () => void;
};

/** Hub chrome on DesktopAPI lifecycle — no AppLink / localStorage projects store. */
export function HubScreen({
  recent,
  error,
  busy,
  onNew,
  onOpen,
  onOpenRecent,
  onDiagnostics,
  onClearError,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState("Untitled");
  const [aspectRatio, setAspectRatio] =
    useState<NonNullable<CreateProjectInput["aspectRatio"]>>("16:9");

  const closeDialog = useCallback(() => {
    if (creating) return;
    setDialogOpen(false);
    setFormError(null);
  }, [creating]);

  const openCreate = useCallback(() => {
    setName("Untitled");
    setAspectRatio("16:9");
    setFormError(null);
    setDialogOpen(true);
  }, []);

  const confirmCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("Project name is required.");
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const ok = await onNew({ name: trimmed, aspectRatio });
      if (ok) {
        setDialogOpen(false);
      } else {
        setFormError("Could not create project.");
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }, [aspectRatio, name, onNew]);

  const dialogBusy = busy || creating;

  return (
    <main className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#18181a]">
      <PanelHeader
        title="Projects"
        actions={
          <Button variant="ghost" size="xs" onClick={onDiagnostics}>
            Diagnostics
          </Button>
        }
      />
      {error ? (
        <p
          className="m-0 border-b border-[var(--danger)] bg-[var(--bg-panel)] px-4 py-2 text-[12px] text-[var(--danger)]"
          role="alert"
        >
          {error}{" "}
          <button type="button" className="underline" onClick={onClearError}>
            Dismiss
          </button>
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <HubSidebar busy={dialogBusy} onNew={openCreate} onOpen={onOpen} />
        <div className="relative min-w-0 flex-1">
          <HubRecentGrid
            recent={recent}
            busy={dialogBusy}
            onNew={openCreate}
            onOpenRecent={onOpenRecent}
          />
          {busy ? (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center"
              style={{ background: "color-mix(in srgb, var(--bg-app) 72%, transparent)" }}
              role="status"
              aria-live="polite"
            >
              <p className="m-0 rounded-md border border-[var(--border-strong)] bg-[var(--bg-panel)] px-4 py-2 text-[13px] text-[var(--fg-primary)]">
                Opening project…
              </p>
            </div>
          ) : null}
        </div>
      </div>
      <Dialog
        open={dialogOpen}
        title="New project"
        onClose={closeDialog}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={creating}
              onClick={closeDialog}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={dialogBusy}
              loading={creating}
              onClick={() => void confirmCreate()}
            >
              Create
            </Button>
          </>
        }
      >
        <label className="editor-shell__field">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Project name"
            disabled={creating}
          />
        </label>
        <Select
          label="Aspect ratio"
          value={aspectRatio}
          disabled={creating}
          onChange={(e) =>
            setAspectRatio(
              e.target.value as NonNullable<CreateProjectInput["aspectRatio"]>,
            )
          }
          options={[
            { value: "16:9", label: "16:9" },
            { value: "9:16", label: "9:16" },
            { value: "1:1", label: "1:1" },
          ]}
        />
        {formError ? (
          <p className="m-0 text-[12px] text-[var(--danger)]" role="alert">
            {formError}
          </p>
        ) : null}
      </Dialog>
    </main>
  );
}
