import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
} from "remotion";
import {
  buildAudioRenderPlan,
  evaluateCompositionFrameV1,
  sampleAudioVolumeLinear,
  type AudioRenderPlan,
} from "@motionvideo/motion-runtime";
import type { MotionRuntimeProject } from "@motionvideo/motion-protocol/runtime";
import type { RenderManifest } from "@motionvideo/render-contracts";
import { RemotionFramePainter } from "./RemotionFramePainter";

export type MotiClipVideoProps = {
  manifest: RenderManifest;
  /** Inline IR. When omitted, the composition fetches `manifest.runtime.url`. */
  runtime?: MotionRuntimeProject | null;
};

function isRuntimeProject(value: unknown): value is MotionRuntimeProject {
  if (typeof value !== "object" || value === null) return false;
  const record = value as { format?: unknown; layers?: unknown };
  return record.format === "motion-runtime" && Array.isArray(record.layers);
}

function useResolvedRuntime(
  manifest: RenderManifest,
  runtimeProp: MotionRuntimeProject | null | undefined,
): MotionRuntimeProject | null {
  const [runtime, setRuntime] = useState<MotionRuntimeProject | null>(() =>
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
          throw new Error("Fetched runtime IR is not a MotionRuntimeProject");
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
 * Production Remotion composition — evaluates each frame via
 * `evaluateCompositionFrameV1`, paints the combined paint buffer, mounts AudioRenderPlan.
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

  const evaluated = evaluateCompositionFrameV1(
    runtime,
    frame,
    fps,
    width,
    height,
    { background },
  );

  const audioPlan = buildAudioRenderPlan({
    runtime,
    fps,
    durationInFrames: manifest.composition.durationInFrames,
  });

  if (!evaluated) {
    return <AbsoluteFill style={{ background }} />;
  }

  return (
    <AbsoluteFill>
      <RemotionFramePainter paint={evaluated.paint} fps={fps} />
      <MotiClipAudio plan={audioPlan} />
    </AbsoluteFill>
  );
}

function MotiClipAudio({ plan }: { plan: AudioRenderPlan }) {
  return (
    <>
      {plan.clips.map((clip, index) => (
        <Sequence
          key={`${clip.assetId}-${index}`}
          from={clip.fromFrame}
          durationInFrames={clip.durationInFrames}
          layout="none"
        >
          <AudioClipVolume clip={clip} fps={plan.fps} />
        </Sequence>
      ))}
    </>
  );
}

function AudioClipVolume({
  clip,
  fps,
}: {
  clip: AudioRenderPlan["clips"][number];
  fps: number;
}) {
  const frame = useCurrentFrame();
  const absoluteFrame = clip.fromFrame + frame;
  const volume = sampleAudioVolumeLinear(clip.volumeEnvelope, absoluteFrame);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const loopStartInFrames =
    clip.loopWindowStartSeconds != null
      ? Math.round(clip.loopWindowStartSeconds * fps)
      : Math.round(clip.trimStartSeconds * fps);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const loopDurationInFrames =
    clip.loopWindowEndSeconds != null && clip.loopWindowStartSeconds != null
      ? Math.round(
          (clip.loopWindowEndSeconds - clip.loopWindowStartSeconds) * fps,
        )
      : clip.trimEndSeconds > 0
        ? Math.round((clip.trimEndSeconds - clip.trimStartSeconds) * fps)
        : undefined;

  const channelPolicy = clip.channelPolicy ?? "stereo";

  return (
    <Audio
      src={clip.uri}
      startFrom={Math.max(0, Math.round(clip.trimStartSeconds * fps))}
      endAt={
        clip.trimEndSeconds > 0
          ? Math.round(clip.trimEndSeconds * fps)
          : undefined
      }
      volume={volume}
      playbackRate={clip.playbackRate}
      loop={clip.loop}
      loopVolumeCurveBehavior="repeat"
      toneFrequency={
        channelPolicy === "left-only"
          ? undefined
          : channelPolicy === "right-only"
            ? undefined
            : undefined
      }
    />
  );
}
