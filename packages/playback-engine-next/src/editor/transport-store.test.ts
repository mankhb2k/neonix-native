import { describe, expect, it } from "vitest";
import { createPlaybackSnapshotStoreV3 } from "./transport-store";

const snapshot = (timeUs: number) => ({ state: "paused" as const, timeUs, generation: 0, readiness: "ready" as const, metrics: { ticks: 0, publishedVideoPlans: 0, publishedAudioPlans: 0, staleOperations: 0, seeks: 0, underruns: 0 } });
describe("PlaybackSnapshotStoreV3", () => { it("coalesces synchronous publishes into one UI notification", async () => { const store = createPlaybackSnapshotStoreV3(snapshot(0)); let notifications = 0; store.subscribe(() => { notifications += 1; }); store.publish(snapshot(1)); store.publish(snapshot(2)); expect(store.getSnapshot().timeUs).toBe(2); expect(notifications).toBe(0); await Promise.resolve(); expect(notifications).toBe(1); }); });
