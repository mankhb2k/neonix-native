import { Film } from "lucide-react";
import { useDropGhostActive } from "../interactions/timeline-preview-session";
import { BASE_LANE_HEIGHT_PX } from "../timeline-scale";

type Props = {
  width: number;
  laneId?: string | null;
};

/**
 * CapCut / web empty-timeline dash — drop hint on the main lane.
 * `active` comes from timeline-preview-session (library drop ghost).
 */
export function EmptyTimelineDash({ width, laneId = null }: Props) {
  const active = useDropGhostActive();
  return (
    <div
      data-track-lane="true"
      data-track-type="main"
      data-track-family="visual"
      data-track-role="base"
      data-lane-id={laneId ?? undefined}
      data-lane-order={-1}
      data-timeline-empty-dash="true"
      className="flex items-center"
      style={{ width, height: BASE_LANE_HEIGHT_PX }}
    >
      <div
        className={`flex h-full w-full select-none items-center justify-start gap-2.5 rounded border border-dashed px-4 transition-all ${
          active
            ? "border-[var(--accent)]/70 bg-[var(--accent)]/10 text-[var(--accent)]"
            : "border-white/15 bg-white/[0.03] text-white/45"
        }`}
      >
        <Film
          size={16}
          strokeWidth={1.5}
          className="ml-1 shrink-0 opacity-70"
        />
        <span className="truncate text-[12px] font-medium tracking-wide opacity-80">
          Kéo khung hình hoặc phương tiện vào đây để bắt đầu tạo
        </span>
      </div>
    </div>
  );
}
