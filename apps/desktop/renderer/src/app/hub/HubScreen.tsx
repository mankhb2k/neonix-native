import type { RecentProject } from "../../../../src/shared/ipc/contracts";
import { Button, PanelHeader } from "../../ui";
import { HubRecentGrid } from "./HubRecentGrid";
import { HubSidebar } from "./HubSidebar";

type Props = {
  recent: RecentProject[];
  error: string | null;
  busy?: boolean;
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (item: RecentProject) => void;
  onDiagnostics: () => void;
  onClearError: () => void;
};

/** Hub chrome on DesktopAPI lifecycle — no AppLink / localStorage / Next. */
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
        <p className="m-0 border-b border-[var(--danger)] bg-[var(--bg-panel)] px-4 py-2 text-[12px] text-[var(--danger)]" role="alert">
          {error}{" "}
          <button type="button" className="underline" onClick={onClearError}>
            Dismiss
          </button>
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <HubSidebar busy={busy} onNew={onNew} onOpen={onOpen} />
        <HubRecentGrid
          recent={recent}
          busy={busy}
          onNew={onNew}
          onOpenRecent={onOpenRecent}
        />
      </div>
    </main>
  );
}
