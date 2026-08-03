import { Film, Music, Square } from "lucide-react";
import type { LaneContentKind } from "./lane-content-kind";

export type { LaneContentKind };

function TextTrackIcon() {
  return (
    <span
      className="select-none text-[9px] font-bold leading-none tracking-tighter"
      aria-hidden
    >
      TT
    </span>
  );
}

type Props = {
  kind: LaneContentKind;
  size?: number;
};

/** Leading track-type glyph — never L1/L2 text. */
export function LaneLeadingIcon({ kind, size = 14 }: Props) {
  switch (kind) {
    case "audio":
      return <Music size={size} strokeWidth={1.5} />;
    case "text":
      return <TextTrackIcon />;
    case "video":
      return <Film size={size} strokeWidth={1.5} />;
    case "component":
    default:
      return <Square size={size} strokeWidth={1.5} />;
  }
}
