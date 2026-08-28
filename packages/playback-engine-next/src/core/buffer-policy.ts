export type AdaptiveBufferDecisionV3 = "fill" | "hold" | "underrun";
export function decideAdaptiveBufferV3(bufferedAheadUs: number, targetAheadUs: number, lowWatermarkUs = targetAheadUs / 2): AdaptiveBufferDecisionV3 {
  if (bufferedAheadUs <= lowWatermarkUs) return "underrun";
  if (bufferedAheadUs < targetAheadUs) return "fill";
  return "hold";
}
