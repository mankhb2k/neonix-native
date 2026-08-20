import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
} from "remotion";
import {
  evaluateRuntimeProjectV2,
  type RuntimeProjectV2,
} from "@motionvideo/motion-runtime";
import type { RenderManifest } from "@motionvideo/render-contracts";
import { RemotionFramePainter } from "./RemotionFramePainter";

export type MotiClipVideoProps = {
  manifest: RenderManifest;
  /** Inline V2 Runtime IR. When omitted, fetches `manifest.runtime.url`. */
  runtime?: RuntimeProjectV2 | null;
};

function isRuntimeProject(value: unknown): value is RuntimeProjectV2 {
  if (typeof value !== "object" || value === null) return false;
  const record = value as {
    format?: unknown;
    formatVersion?: unknown;
    nodes?: unknown;
  };
  return (
    record.format === "motion-runtime" &&
    record.formatVersion === 2 &&
    Array.isArray(record.nodes)
  );
}

function useResolvedRuntime(
  manifest: RenderManifest,
  runtimeProp: RuntimeProjectV2 | null | undefined,
): RuntimeProjectV2 | null {
  const [runtime, setRuntime] = useState<RuntimeProjectV2 | null>(() =>
    isRuntimeProject(runtimeProp) ? runtimeProp : null,
  );

  useEffect(() => {
    if (isRuntimeProject(runtimeProp)) {
      setRuntime(runtimeProp);
      return;
    }
    const url = manifest.runtime?.url;
    if (!url || url.startsWith("file:")) {
      return;
    }
    const handle = delayRender("load-runtime-ir");
    let cancelled = false;
    void fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to fetch runtime IR (${response.status}): ${url}`,
          );
        }
        return response.json();
      })
      .then((json) => {
        const parsed = json as unknown;
        if (!isRuntimeProject(parsed)) {
          throw new Error("Fetched runtime IR is not RuntimeProjectV2");
        }
        if (!cancelled) setRuntime(parsed);
        continueRender(handle);
      })
      .catch((error) => {
        cancelRender(error);
      });
    return () => {
      cancelled = true;
    };
  }, [manifest.runtime?.url, runtimeProp]);

  return runtime;
}

/**
 * Production Remotion composition for the V2 Runtime IR. It evaluates each
 * frame through the shared V2 runtime and paints the resulting command buffer.
 */
export function MotiClipVideo({ manifest, runtime: runtimeProp }: MotiClipVideoProps) {
  const runtime = useResolvedRuntime(manifest, runtimeProp);
  const frame = useCurrentFrame();
  const fps = manifest.composition.fps;
  const { width, height, background } = {
    width: manifest.composition.width,
    height: manifest.composition.height,
    background: manifest.composition.background,
  };

  if (!runtime) {
    return <AbsoluteFill style={{ background }} />;
  }

  void width;
  void height;
  void background;
  const evaluated = evaluateRuntimeProjectV2(runtime, frame);

  return (
    <AbsoluteFill>
      <RemotionFramePainter paint={evaluated} fps={fps} />
    </AbsoluteFill>
  );
}
