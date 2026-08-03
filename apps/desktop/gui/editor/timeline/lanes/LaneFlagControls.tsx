import { Eye, EyeOff, Lock, Unlock, Volume2, VolumeX } from "lucide-react";
import type { TimelineLane, TimelineLaneFlags } from "@motionvideo/editor-core";
import type { ReactNode } from "react";

type Props = {
  lane: TimelineLane;
  /** Icon chính (video / TT / vuông / nốt nhạc). */
  leading: ReactNode;
  disabled?: boolean;
  onPatch: (patch: TimelineLaneFlags) => void;
};

/**
 * Control lane: lock (+ visible cho visual / mute cho audio).
 */
export function LaneFlagControls({
  lane,
  leading,
  disabled,
  onPatch,
}: Props) {
  const locked = Boolean(lane.locked);
  const hidden = lane.kind === "visual" && lane.visible === false;
  const muted = lane.kind === "audio" && Boolean(lane.muted);

  return (
    <div className="flex min-w-0 items-center gap-4">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[var(--fg-muted)]">
        {leading}
      </span>
      <button
        type="button"
        className="rounded p-0.5 text-[var(--fg-muted)] hover:text-[var(--fg-primary)] disabled:opacity-40"
        title={locked ? "Mở khóa lane" : "Khóa lane"}
        aria-pressed={locked}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onPatch({ locked: !locked });
        }}
      >
        {locked ? <Lock size={12} /> : <Unlock size={12} />}
      </button>
      {lane.kind === "visual" ? (
        <button
          type="button"
          className="rounded p-0.5 text-[var(--fg-muted)] hover:text-[var(--fg-primary)] disabled:opacity-40"
          title={hidden ? "Hiện lane" : "Ẩn lane"}
          aria-pressed={hidden}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onPatch({ visible: hidden });
          }}
        >
          {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      ) : (
        <button
          type="button"
          className="rounded p-0.5 text-[var(--fg-muted)] hover:text-[var(--fg-primary)] disabled:opacity-40"
          title={muted ? "Bật tiếng lane" : "Tắt tiếng lane"}
          aria-pressed={muted}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onPatch({ muted: !muted });
          }}
        >
          {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>
      )}
    </div>
  );
}
