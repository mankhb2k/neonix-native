import { FolderOpen, Home, Plus } from "lucide-react";
import { Button } from "../../ui";

type Props = {
  busy?: boolean;
  onNew: () => void;
  onOpen: () => void;
};

export function HubSidebar({ busy, onNew, onOpen }: Props) {
  return (
    <aside className="flex w-[190px] shrink-0 flex-col justify-between border-r border-[var(--border-strong)] bg-[#141416] p-4 select-none">
      <div className="flex flex-col gap-6">
        <nav className="flex flex-col gap-1">
          <button
            type="button"
            className="flex cursor-pointer items-center gap-2.5 rounded-full bg-[#2a2a2e] px-3 py-1.5 text-[13px] font-medium text-white shadow-sm"
          >
            <Home size={15} />
            <span>Home</span>
          </button>
        </nav>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            variant="primary"
            className="w-full rounded-full"
            disabled={busy}
            leftIcon={<Plus size={14} />}
            onClick={onNew}
          >
            New project
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-full"
            disabled={busy}
            leftIcon={<FolderOpen size={14} />}
            onClick={onOpen}
          >
            Open…
          </Button>
        </div>
      </div>
      <div className="font-mono text-[11px] text-[var(--fg-disabled)]">
        MotionVideo desktop
      </div>
    </aside>
  );
}
