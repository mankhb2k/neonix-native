import { describe, expect, it } from "vitest";
import { compareRuntimePlansV3 } from "./shadow-compare";

const project = (id: string) => ({ format: "motion-runtime" as const, runtimeVersion: 3 as const, projectId: id, visual: { composition: { width: 1, height: 1, fps: 30, graphId: "g" }, view: { worldToClipMatrix: new Float64Array(16) }, nodes: [] }, mediaCatalog: { assets: [] }, videoTimeline: { instances: [] }, audioTimeline: { sampleRate: 48000 as const, tracks: [] } });
describe("runtime shadow comparison", () => { it("compares semantic plans at bounded probes", () => { const report = compareRuntimePlansV3(project("a"), project("b"), [{ timeUs: 0, startSample: 0, endSample: 128 }]); expect(report).toMatchObject({ equal: true, probes: 1, mismatches: [] }); }); });
