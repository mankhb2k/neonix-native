import { useState } from "react";
import {
  Button,
  PanelHeader,
  Search,
  TabsDesktop,
  Tooltip,
} from "../../ui";

/** Dev-only visual QA for UI primitives (?gallery=1). */
export function UiGallery({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState("buttons");
  return (
    <main className="flex h-full w-full flex-col bg-[var(--bg-app)] text-[var(--fg)]">
      <PanelHeader
        title="UI Gallery"
        actions={
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        }
      />
      <div className="h-10 border-b border-[var(--border-subtle)]">
        <TabsDesktop
          value={tab}
          onChange={setTab}
          items={[
            { id: "buttons", label: "Buttons" },
            { id: "search", label: "Search" },
          ]}
        />
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-6">
        {tab === "buttons" ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="action">Action</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Tooltip content="Danger action">
              <Button variant="danger">Danger</Button>
            </Tooltip>
          </div>
        ) : (
          <div className="max-w-sm">
            <Search placeholder="Search primitives…" />
          </div>
        )}
      </div>
    </main>
  );
}
