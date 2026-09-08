"use client";

import { useMemo } from "react";
import { useTransportStore } from "@/hooks/editor/use-transport-store";
import {
  evaluateStageLayersAtTime,
  type StageRuntimeSnapshot,
} from "@/lib/editor/stage/runtime-query";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

/** Creates the single evaluated layer snapshot shared by all stage tools. */
export function useStageRuntimeSnapshot(
  document: MotionProtocolV2,
): StageRuntimeSnapshot {
  const currentTime = useTransportStore((state) => state.currentTime);
  return useMemo(
    () => evaluateStageLayersAtTime(document, currentTime),
    [currentTime, document],
  );
}
