import type { AudioBackendV3 } from "./audio-backend";
import type { RuntimeAudioMixPlanV3 } from "@motionvideo/motion-runtime";

export type BufferSourceBackendOptionsV3 = { maxSamples?: number; onPlan?: (plan: RuntimeAudioMixPlanV3) => void };
export type BufferSourceBackendV3 = AudioBackendV3 & { readonly lastPlan: RuntimeAudioMixPlanV3 | undefined; readonly rejectedPlans: number };
export function createBufferSourceBackendV3(options: BufferSourceBackendOptionsV3 = {}): BufferSourceBackendV3 {
  const maxSamples = options.maxSamples ?? 48000 * 30;
  let lastPlan: RuntimeAudioMixPlanV3 | undefined;
  let rejectedPlans = 0;
  return { get lastPlan() { return lastPlan; }, get rejectedPlans() { return rejectedPlans; }, publish(plan) { if (plan.endSample - plan.startSample > maxSamples) { rejectedPlans += 1; return; } lastPlan = plan; options.onPlan?.(plan); }, dispose() { lastPlan = undefined; } };
}
