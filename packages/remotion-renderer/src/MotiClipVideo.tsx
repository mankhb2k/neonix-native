import { AbsoluteFill, Audio, Sequence, useCurrentFrame } from "remotion";
import {
  buildAudioRenderPlan,
  evaluateCompositionFrame,
  sampleAudioVolumeAtFrame,
  type AudioRenderPlan,
} from "@motionvideo/motion-runtime";
import type { NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";
import type { RenderManifest } from "@motionvideo/render-contracts";
import { RemotionPaintRenderer } from "./RemotionPaintRenderer";

export type MotiClipVideoProps = {
  manifest: RenderManifest;
  runtime: NormalizedMotionProjectV2;
};

/**
 * Production Remotion composition — evaluates once per frame into EvaluatedFrame,
 * paints paint buffer, and mounts audio from AudioRenderPlan.
 * Does not use spring()/interpolate() for motion semantics.
 */
export function MotiClipVideo({ manifest, runtime }: MotiClipVideoProps) {
  const frame = useCurrentFrame();
  const fps = manifest.composition.fps;
  const { width, height, background } = {
    width: manifest.composition.width,
    height: manifest.composition.height,
    background: manifest.composition.background,
  };
  const evaluated = evaluateCompositionFrame(
    runtime,
    frame,
    fps,
    width,
    height,
    undefined,
    background,
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
      <RemotionPaintRenderer paint={evaluated.paint} />
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
  const volume = sampleAudioVolumeAtFrame(clip.volumeEnvelope, absoluteFrame);
  return (
    <Audio
      src={clip.uri}
      startFrom={Math.max(0, Math.round(clip.trimStartSeconds * fps))}
      volume={volume}
      playbackRate={clip.playbackRate}
      loop={clip.loop}
    />
  );
}
