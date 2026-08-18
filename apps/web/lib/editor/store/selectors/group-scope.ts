"use client";

/**
 * Group scope — derive the current (scoped) layer list + breadcrumb trail from
 * the store's `groupPath`, mirroring clipkit's `resolveGroupPath`. Returns a
 * stable `{ layers, crumbs, timeOffset }` per scope change.
 */

import { resolveGroupPath } from "@motionvideo/editor-core";
import type { MotionLayer } from "@motionvideo/motion-protocol";
import { useEditorStore } from "@/lib/editor/editor-store";
import { useMemo } from "react";

const EMPTY: readonly MotionLayer[] = [];

export interface GroupScope {
  layers: MotionLayer[];
  crumbs: MotionLayer[];
  timeOffset: number;
}

export function useGroupScope(): GroupScope {
  const layers = useEditorStore((s) => s.project?.layers);
  const groupPath = useEditorStore((s) => s.groupPath);

  return useMemo(
    () => resolveGroupPath(layers ?? EMPTY, groupPath),
    [layers, groupPath],
  );
}
