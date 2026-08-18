/**
 * Group scope — derive the current (scoped) layer list + breadcrumb trail from
 * `groupPath`, mirroring clipkit's `resolveGroupPath`. Pure selector only;
 * the React hook lives in `hooks/editor/use-group-scope.ts`.
 */

import { resolveGroupPath } from "@motionvideo/editor-core";
import type { MotionLayer } from "@motionvideo/motion-protocol";

const EMPTY: readonly MotionLayer[] = [];

export interface GroupScope {
  layers: MotionLayer[];
  crumbs: MotionLayer[];
  timeOffset: number;
}

export function selectGroupScope(
  layers: readonly MotionLayer[] | undefined | null,
  groupPath: readonly string[],
): GroupScope {
  return resolveGroupPath(layers ?? EMPTY, groupPath);
}
