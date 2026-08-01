import { useState } from "react";
import { PanelHeader, TabsDesktop } from "../../ui";
import { InspectorPanel } from "./InspectorPanel";
import type {
  DocumentPropertyCommand,
  EditorSelection,
  TimelineClip,
  TimelineLane,
} from "@motionvideo/editor-core";
import type { MotionProject } from "@motionvideo/motion-schema";

type Props = {
  project: MotionProject | null;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  selection: EditorSelection;
  disabled?: boolean;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (input: {
    command: DocumentPropertyCommand;
    label: string;
    coalesceKey?: string;
    entryId?: string;
  }) => void;
};

/**
 * Inspector chrome (UI-7) — tabs + registry-backed properties only.
 * Missing sections stay disabled (no temporary parallel state).
 */
export function InspectorDock(props: Props) {
  const [tab, setTab] = useState("properties");
  return (
    <aside className="inspector-dock" aria-label="Inspector">
      <PanelHeader title="Inspector" />
      <div style={{ height: 40, borderBottom: "1px solid var(--border-subtle)" }}>
        <TabsDesktop
          value={tab}
          onChange={setTab}
          items={[
            { id: "properties", label: "Properties" },
            { id: "animation", label: "Animation", disabled: true },
            { id: "effects", label: "Effects", disabled: true },
          ]}
        />
      </div>
      {tab === "properties" ? <InspectorPanel {...props} /> : null}
    </aside>
  );
}
