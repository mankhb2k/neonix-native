import type { MotionProtocolV2, V2Track, V2TextSpan } from "@motionvideo/motion-protocol/v2";
import { MotionCompilerLoweringError } from "../compiler";

type V2Layer = MotionProtocolV2["layers"][number];
type V2TextLayer = Extract<V2Layer, { type: "text" }>;

/**
 * Animatable span fields a range-selector track may target. Mirrors the
 * `spanNumberFields`/color/font-size allowlist enforced on ordinary
 * `payload.chunks.spans.<id>.<field>` tracks by `trackValueKinds` in
 * `@motionvideo/motion-protocol`'s `project.ts` — kept in sync by hand since
 * that allowlist is not exported.
 */
const SPAN_NUMBER_FIELDS = new Set(["letterSpacing", "wordSpacing", "strokeWidth", "strokeOpacity", "textLength", "fillOpacity"]);

function spanFieldKind(field: string): "number" | "color" | null {
  if (SPAN_NUMBER_FIELDS.has(field)) return "number";
  if (field === "fill" || field === "stroke") return "color";
  if (field === "font.size") return "number";
  return null;
}

/**
 * Expands `payload.rangeSelectors` (typewriter/stagger authoring shorthand)
 * into real per-character spans and id-addressed tracks, reusing the
 * existing `payload.chunks.spans.<id>.<field>` addressing that
 * `sampleMotionLayerAtTime` already understands — no sampler changes needed.
 *
 * Non-text layers and text layers without selectors pass through unchanged.
 */
export function expandTextRangeSelectors(layer: V2Layer): V2Layer {
  if (layer.type !== "text" || !layer.payload.rangeSelectors?.length) return layer;
  let textLayer: V2TextLayer = layer;

  for (const selector of textLayer.payload.rangeSelectors!) {
    const selectorPath = `layers.${layer.id}.payload.rangeSelectors.${selector.id}`;
    if (selector.unit === "word") {
      throw new MotionCompilerLoweringError(
        "UNSUPPORTED_TEXT_RANGE_UNIT",
        `Text range selector unit "word" is not yet implemented: ${selector.id}`,
        selectorPath,
      );
    }

    const field = spanFieldKind(selector.track.path);
    if (!field) {
      throw new MotionCompilerLoweringError(
        "INVALID_TEXT_RANGE_TRACK_PATH",
        `Text range selector track path does not identify an animatable span field: ${selector.track.path}`,
        `${selectorPath}.track.path`,
      );
    }

    const sourceLength = textLayer.payload.source.text.length;
    const range = selector.range === "all" ? { start: 0, end: sourceLength } : selector.range;
    const unitCount = range.end - range.start;
    const newTracks: V2Track[] = [];
    const coveredPositions = new Set<number>();

    const chunks = textLayer.payload.chunks.map((chunk) => {
      if (chunk.sourceRange.end <= range.start || chunk.sourceRange.start >= range.end) return chunk;
      const spans: V2TextSpan[] = [];
      for (const span of chunk.spans) {
        const overlapStart = Math.max(span.sourceRange.start, range.start);
        const overlapEnd = Math.min(span.sourceRange.end, range.end);
        if (overlapStart >= overlapEnd) {
          spans.push(span);
          continue;
        }
        if (span.sourceRange.start < overlapStart) {
          spans.push({ ...span, id: `${span.id}__${selector.id}_pre`, sourceRange: { start: span.sourceRange.start, end: overlapStart } });
        }
        for (let position = overlapStart; position < overlapEnd; position += 1) {
          coveredPositions.add(position);
          const charSpanId = `${selector.id}__char_${position}`;
          spans.push({ ...span, id: charSpanId, sourceRange: { start: position, end: position + 1 } });

          const positionIndex = position - range.start;
          const orderIndex = selector.stagger.direction === "reverse" ? unitCount - 1 - positionIndex : positionIndex;
          const delayMs = orderIndex * selector.stagger.perUnitDelayMs;
          newTracks.push({
            ...selector.track,
            id: `${selector.id}__track_${position}`,
            path: `payload.chunks.spans.${charSpanId}.${selector.track.path}`,
            keyframes: selector.track.keyframes.map((keyframe) => ({ ...keyframe, time: keyframe.time + delayMs })),
          });
        }
        if (span.sourceRange.end > overlapEnd) {
          spans.push({ ...span, id: `${span.id}__${selector.id}_post`, sourceRange: { start: overlapEnd, end: span.sourceRange.end } });
        }
      }
      return { ...chunk, spans };
    });

    if (coveredPositions.size !== unitCount) {
      throw new MotionCompilerLoweringError(
        "TEXT_RANGE_SELECTOR_OUT_OF_BOUNDS",
        `Text range selector range [${range.start}, ${range.end}) is not fully covered by existing spans: ${selector.id}`,
        selectorPath,
      );
    }

    textLayer = {
      ...textLayer,
      payload: { ...textLayer.payload, chunks },
      tracks: [...(textLayer.tracks ?? []), ...newTracks],
    };
  }

  return { ...textLayer, payload: { ...textLayer.payload, rangeSelectors: undefined } };
}

/** Expands range selectors across every layer in a project (see `expandTextRangeSelectors`). */
export function expandMotionProjectTextRangeSelectors(project: MotionProtocolV2): MotionProtocolV2 {
  if (!project.layers.some((layer) => layer.type === "text" && layer.payload.rangeSelectors?.length)) return project;
  return { ...project, layers: project.layers.map(expandTextRangeSelectors) };
}
