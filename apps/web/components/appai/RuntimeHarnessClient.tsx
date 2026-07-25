"use client";

import { useMemo, useState } from "react";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import { parseMotionProjectV2 } from "@motionvideo/motion-schema";
import { applyMatrix, evaluateScene, quantizeTimeToFrame } from "@motionvideo/motion-runtime";
import hierarchyFixture from "@/fixtures/hierarchy-transform.mt.json";
import { previewParitySnapshot, stageSizeForAspect } from "@/lib/runtime/preview-evaluate";

const TIMES = [0, 1, 1.5] as const;

export function RuntimeHarnessClient() {
  const [time, setTime] = useState(0);
  const project = useMemo(() => parseMotionProjectV2(hierarchyFixture), []);
  const runtime = useMemo(() => compileMotionProject(project), [project]);
  const scene = runtime.scenes[0]!;
  const fps = runtime.metadata.fps;
  const frame = quantizeTimeToFrame(time, fps);
  const snapshot = previewParitySnapshot(runtime, scene.id, frame.time);
  const stage = stageSizeForAspect(runtime.metadata.aspectRatio);

  const evaluated = evaluateScene(scene, frame.time);
  const parityPayload = {
    fixture: "hierarchy-transform",
    sceneId: scene.id,
    time: frame.time,
    frameIndex: frame.frameIndex,
    fps,
    nodes: evaluated.map((item) => {
      const origin = applyMatrix(item.worldMatrix, 0, 0);
      return {
        id: item.node.id,
        type: item.node.type,
        worldOrigin: origin,
        worldOpacity: item.worldOpacity,
        flipX: item.transform.flipX,
        worldMatrixA: item.worldMatrix.a,
      };
    }),
  };

  return (
    <main style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui", maxWidth: 960, margin: "0 auto" }}>
      <h1>Runtime IR harness</h1>
      <p>Browser evaluateScene parity vs worker hierarchy-transform fixture.</p>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        {TIMES.map((candidate) => (
          <button
            key={candidate}
            type="button"
            data-testid={`parity-time-${String(candidate).replace(".", "_")}`}
            onClick={() => setTime(candidate)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: frame.time === candidate ? "2px solid #17202A" : "1px solid #ccc",
              background: frame.time === candidate ? "#e8eef5" : "#fff",
              cursor: "pointer",
            }}
          >
            t={candidate}
          </button>
        ))}
        <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          scrub
          <input
            type="range"
            min={0}
            max={scene.duration}
            step={1 / fps}
            value={frame.time}
            onChange={(event) => setTime(Number(event.target.value))}
            data-testid="harness-time-scrubber"
          />
        </label>
      </div>
      <pre
        data-testid="runtime-parity-json"
        data-time={frame.time}
        style={{
          background: "#0f1720",
          color: "#e2e8f0",
          padding: 16,
          borderRadius: 12,
          overflow: "auto",
          fontSize: 12,
        }}
      >
        {JSON.stringify(parityPayload, null, 2)}
      </pre>
      <div
        data-testid="runtime-harness-stage"
        style={{
          marginTop: 24,
          width: stage.width * 0.25,
          height: stage.height * 0.25,
          background: runtime.metadata.brand.primaryColor ?? "#17202A",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: stage.width,
            height: stage.height,
            transform: "scale(0.25)",
            transformOrigin: "top left",
          }}
        >
          {snapshot.nodes.map((node) => {
            if (node.type === "group" || node.type === "bone" || node.type === "camera" || !node.visible) return null;
            return (
              <div
                key={node.id}
                data-testid={`parity-node-${node.id}`}
                data-world-x={node.worldOrigin.x.toFixed(4)}
                data-world-y={node.worldOrigin.y.toFixed(4)}
                data-world-opacity={node.worldOpacity.toFixed(4)}
                data-flip-x={node.transform.flipX ? "1" : "0"}
                style={{
                  position: "absolute",
                  left: node.worldBounds.x,
                  top: node.worldBounds.y,
                  width: node.worldBounds.width,
                  height: node.worldBounds.height,
                  opacity: node.worldOpacity,
                  border: "1px solid rgba(255,255,255,0.45)",
                  background: "rgba(255,255,255,0.12)",
                  color: "#fff",
                  fontSize: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {node.id.replace(/^part\./, "")}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
