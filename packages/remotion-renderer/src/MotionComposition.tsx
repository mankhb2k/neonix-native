import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  evaluateCompositionSnapshot,
} from "@motionvideo/motion-runtime";
import type { NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";
import { RemotionSnapshotRenderer } from "./RemotionSnapshotRenderer";

export type MotionCompositionProps = {
  runtime: NormalizedMotionProjectV2;
  width: number;
  height: number;
  background?: string;
  /** When set, frame is local to this scene. Omit for global timeline. */
  sceneId?: string;
};

/** Remotion Player composition — fallback path only (P7). */
export function MotionComposition({
  runtime,
  width,
  height,
  background,
  sceneId,
}: MotionCompositionProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const snapshot = evaluateCompositionSnapshot(
    runtime,
    frame,
    fps,
    width,
    height,
    sceneId,
    background,
  );
  if (!snapshot) {
    return <AbsoluteFill style={{ background: background ?? "#000" }} />;
  }
  return <RemotionSnapshotRenderer snapshot={snapshot} />;
}
