"use client";

import { Film, Music, Square } from "lucide-react";
import type { MotionProject } from "@motionvideo/motion-schema";
import type { TimelineClip, TimelineLane } from "@/lib/editor/timeline-clips";

type LaneContentKind = "video" | "text" | "component" | "audio";

function TextTrackIcon() {
  return (
    <span
      className="text-[9px] font-bold leading-none tracking-tighter select-none"
      aria-hidden
    >
      TT
    </span>
  );
}

/** Infer overlay lane content from scene nodes on that lane. */
export function resolveLaneContentKind(
  lane: TimelineLane,
  clips: ReadonlyArray<TimelineClip>,
  project: MotionProject | null,
): LaneContentKind {
  if (lane.kind === "audio") return "audio";
  if (lane.role === "base") return "video";

  const sceneIds = clips
    .filter(
      (clip): clip is Extract<TimelineClip, { kind: "scene" }> =>
        clip.laneId === lane.id && clip.kind === "scene",
    )
    .map((clip) => clip.sceneId);
  if (sceneIds.length === 0 || !project) return "component";

  const kinds = new Set<Exclude<LaneContentKind, "audio">>();
  for (const sceneId of sceneIds) {
    const scene = project.scenes.find((entry) => entry.id === sceneId);
    if (!scene) continue;
    for (const node of scene.nodes) {
      if (node.type === "text") kinds.add("text");
      else if (
        node.type === "shape" ||
        node.type === "path" ||
        node.type === "component"
      ) {
        kinds.add("component");
      } else if (
        node.type === "video" ||
        node.type === "image" ||
        node.type === "svg"
      ) {
        kinds.add("video");
      }
    }
  }

  if (kinds.size === 1) {
    const only = kinds.values().next().value;
    if (only) return only;
  }
  // Mixed / unknown overlay → thành phần (square).
  return "component";
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
