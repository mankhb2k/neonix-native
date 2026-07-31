import { useState } from "react";
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
  onNew: (input?: CreateProjectInput) => void;
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
  const [name, setName] = useState("Untitled");
  const [aspectRatio, setAspectRatio] =
    useState<NonNullable<CreateProjectInput["aspectRatio"]>>("16:9");

  const openCreate = () => {
    setName("Untitled");
    setAspectRatio("16:9");
    setDialogOpen(true);
  };

  const confirmCreate = () => {
    setDialogOpen(false);
    onNew({ name, aspectRatio });
  };

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
        <HubSidebar busy={busy} onNew={openCreate} onOpen={onOpen} />
        <HubRecentGrid
          recent={recent}
          busy={busy}
          onNew={openCreate}
          onOpenRecent={onOpenRecent}
        />
      </div>
      <Dialog
        open={dialogOpen}
        title="New project"
        onClose={() => setDialogOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy} onClick={confirmCreate}>
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
          />
        </label>
        <Select
          label="Aspect ratio"
          value={aspectRatio}
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
      </Dialog>
    </main>
  );
}
