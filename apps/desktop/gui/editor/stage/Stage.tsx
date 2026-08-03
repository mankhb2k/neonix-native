import { memo } from "react";
import { PanelHeader } from "../../ui";

/** Center preview (web PreviewStage). */
export const Stage = memo(function Stage() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <PanelHeader title="Preview" />
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        style={{
          backgroundImage: "radial-gradient(#27272A 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
        data-testid="runtime-preview-canvas"
      >
        <span className="text-[13px] text-[var(--fg-muted)]">Stage</span>
      </div>
    </div>
  );
});
