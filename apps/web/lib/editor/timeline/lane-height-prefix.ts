/** Build cumulative lane heights used by timeline hit testing. */
export function buildLaneHeightPrefix(
  laneHeights: readonly number[],
): number[] {
  const prefix = new Array<number>(laneHeights.length + 1);
  prefix[0] = 0;
  for (let i = 0; i < laneHeights.length; i += 1) {
    prefix[i + 1] = prefix[i] + Math.max(1, laneHeights[i]);
  }
  return prefix;
}
