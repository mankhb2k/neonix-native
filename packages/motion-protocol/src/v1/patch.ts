/**
 * V1 Native Patch Contract — safe editor surface for AI agents and MCP tools.
 *
 * Design principles:
 *  1. Every operation maps to a V1-first path (`timeline.visualTracks`).
 *  2. Diagnostics are structured (path + message + severity), never raw throws.
 *  3. Patch output is always re-validated with `MotionProjectV1Schema`.
 *  4. Idempotent by design — applying the same patch twice yields the same
 *     result (or a no-op diagnostic).
 */

import { z } from "zod";
import type { MotionProjectV1 } from "./project";
import { MotionProjectV1Schema } from "./project";
import { IdSchema, FiniteNumberSchema } from "./common";
import { CompositionSettingsSchema } from "./composition";
import { DesignTokensSchema } from "./variables";
import { SceneDefinitionV1Schema } from "./scenes";
import {
  VisualClipV1Schema,
  AudioTrackV1Schema,
  type VisualClipV1,
} from "./timeline/schema";
import { AssetV1Schema } from "./assets";
import { ProjectVariableV1Schema } from "./variables";
import { ProjectBindingV1Schema } from "./variables";

// ── Patch format constants ────────────────────────────────────────────

export const MOTION_PROJECT_V1_PATCH_FORMAT_VERSION = 1 as const;

// ── Diagnostics ───────────────────────────────────────────────────────

export interface V1PatchDiagnostic {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface V1PatchResult {
  /** Cloned + patched project, or null if the project was unrecoverable. */
  project: MotionProjectV1 | null;
  /** Diagnostics produced during apply. Empty = clean apply. */
  diagnostics: V1PatchDiagnostic[];
}

function diagnostic(
  path: string,
  message: string,
  severity: "error" | "warning" = "error",
): V1PatchDiagnostic {
  return { path, message, severity };
}

// ── Operation schemas ─────────────────────────────────────────────────

/** Set composition properties. Omitted fields keep their current values. */
export const V1PatchSetCompositionSchema = z
  .object({
    op: z.literal("setComposition"),
    changes: CompositionSettingsSchema.partial(),
  })
  .strict();

/** Set design token categories (colors, fonts, spacing, radii, motion). */
export const V1PatchSetTokensSchema = z
  .object({
    op: z.literal("setTokens"),
    changes: DesignTokensSchema.partial(),
  })
  .strict();

/** Add a scene definition to the project. */
export const V1PatchAddSceneSchema = z
  .object({
    op: z.literal("addScene"),
    scene: SceneDefinitionV1Schema,
    insertAt: z.number().int().nonnegative().optional(),
  })
  .strict();

/** Update scene-level fields (duration, name). */
export const V1PatchUpdateSceneSchema = z
  .object({
    op: z.literal("updateScene"),
    sceneId: IdSchema,
    changes: z
      .object({
        duration: FiniteNumberSchema.positive().optional(),
        name: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

/** Remove a scene and all references to it from visual tracks. */
export const V1PatchRemoveSceneSchema = z
  .object({
    op: z.literal("removeScene"),
    sceneId: IdSchema,
  })
  .strict();

/** Add a visual clip to a track. */
export const V1PatchAddVisualClipSchema = z
  .object({
    op: z.literal("addVisualClip"),
    trackId: IdSchema,
    clip: VisualClipV1Schema,
    insertAt: z.number().int().nonnegative().optional(),
  })
  .strict();

/** Trim a visual clip (adjust trimStart and/or duration). */
export const V1PatchTrimVisualClipSchema = z
  .object({
    op: z.literal("trimVisualClip"),
    trackId: IdSchema,
    clipId: IdSchema,
    trimStart: FiniteNumberSchema.nonnegative().optional(),
    duration: FiniteNumberSchema.positive().optional(),
  })
  .strict();

/** Move a visual clip from one track to another. */
export const V1PatchMoveVisualClipSchema = z
  .object({
    op: z.literal("moveVisualClip"),
    clipId: IdSchema,
    fromTrackId: IdSchema,
    toTrackId: IdSchema,
    insertAt: z.number().int().nonnegative().optional(),
    start: FiniteNumberSchema.nonnegative().optional(),
  })
  .strict();

/** Reorder clips on a visual track by providing the new ordered list of clip ids. */
export const V1PatchReorderVisualTrackSchema = z
  .object({
    op: z.literal("reorderVisualTrack"),
    trackId: IdSchema,
    orderedClipIds: z.array(IdSchema).min(1),
  })
  .strict();

/** Add or update a project asset. */
export const V1PatchAssetSchema = z
  .object({
    op: z.enum(["addAsset", "updateAsset"]),
    asset: AssetV1Schema,
  })
  .strict();

/** Add or update a project variable. */
export const V1PatchVariableSchema = z
  .object({
    op: z.enum(["addVariable", "updateVariable"]),
    variable: ProjectVariableV1Schema,
  })
  .strict();

/** Add or update a project binding. */
export const V1PatchBindingSchema = z
  .object({
    op: z.enum(["addBinding", "updateBinding"]),
    binding: ProjectBindingV1Schema,
  })
  .strict();

/** Add or update an audio track on the timeline. */
export const V1PatchAudioTrackSchema = z
  .object({
    op: z.enum(["addAudioTrack", "updateAudioTrack"]),
    audioTrack: AudioTrackV1Schema,
  })
  .strict();

/** Add or update a caption token on a caption track. */
export const V1PatchCaptionCueSchema = z
  .object({
    op: z.enum(["addCaptionCue", "updateCaptionCue"]),
    trackId: IdSchema,
    token: z
      .object({
        id: IdSchema,
        text: z.string().min(1),
        start: FiniteNumberSchema.nonnegative(),
        end: FiniteNumberSchema.positive(),
      })
      .strict(),
  })
  .strict();

/** Set a value at an arbitrary path (for AI repair patches — use sparingly). */
export const V1PatchSetValueSchema = z
  .object({
    op: z.literal("setValue"),
    path: z.string().min(1).max(256),
    value: z.unknown(),
  })
  .strict();

// ── Union operation schema ────────────────────────────────────────────

export const V1PatchOpSchema = z.discriminatedUnion("op", [
  V1PatchSetCompositionSchema,
  V1PatchSetTokensSchema,
  V1PatchAddSceneSchema,
  V1PatchUpdateSceneSchema,
  V1PatchRemoveSceneSchema,
  V1PatchAddVisualClipSchema,
  V1PatchTrimVisualClipSchema,
  V1PatchMoveVisualClipSchema,
  V1PatchReorderVisualTrackSchema,
  V1PatchAssetSchema,
  V1PatchVariableSchema,
  V1PatchBindingSchema,
  V1PatchAudioTrackSchema,
  V1PatchCaptionCueSchema,
  V1PatchSetValueSchema,
]);

export type V1PatchOp = z.infer<typeof V1PatchOpSchema>;

// ── Root patch schema ─────────────────────────────────────────────────

export const MotionProjectV1PatchSchema = z
  .object({
    format: z.literal("motion-project-patch"),
    formatVersion: z.literal(MOTION_PROJECT_V1_PATCH_FORMAT_VERSION),
    baseRevision: FiniteNumberSchema.int().nonnegative(),
    operations: z.array(V1PatchOpSchema).min(1).max(1000),
  })
  .strict();

export type MotionProjectV1Patch = z.infer<typeof MotionProjectV1PatchSchema>;

// ── Apply ─────────────────────────────────────────────────────────────

function clone(project: MotionProjectV1): MotionProjectV1 {
  return JSON.parse(JSON.stringify(project)) as MotionProjectV1;
}

/**
 * Apply a V1 patch to a motion project.
 *
 * Returns a **new** project (no mutation) and structured diagnostics.
 * The output is always re-validated with `MotionProjectV1Schema`.
 */
export function applyMotionProjectV1Patch(
  project: MotionProjectV1,
  patchInput: unknown,
): V1PatchResult {
  const patchResult = MotionProjectV1PatchSchema.safeParse(patchInput);
  if (!patchResult.success) {
    return {
      project: null,
      diagnostics: patchResult.error.issues.map((issue) => ({
        path: issue.path.join(".") || "patch",
        message: issue.message,
        severity: "error" as const,
      })),
    };
  }

  const patch = patchResult.data;
  const diagnostics: V1PatchDiagnostic[] = [];
  let next = clone(project);

  for (let i = 0; i < patch.operations.length; i++) {
    const op = patch.operations[i]!;
    const opPrefix = `operations[${i}]`;

    switch (op.op) {
      case "setComposition": {
        next = {
          ...next,
          composition: { ...next.composition, ...op.changes },
        };
        break;
      }

      case "setTokens": {
        next = {
          ...next,
          tokens: { ...next.tokens, ...op.changes },
        };
        break;
      }

      case "addScene": {
        if (next.scenes.some((s) => s.id === op.scene.id)) {
          diagnostics.push(
            diagnostic(
              `${opPrefix}.scene.id`,
              `Scene already exists: ${op.scene.id}`,
            ),
          );
          break;
        }
        const newScenes = [...next.scenes];
        newScenes.splice(op.insertAt ?? newScenes.length, 0, op.scene);
        next = { ...next, scenes: newScenes };
        break;
      }

      case "updateScene": {
        const idx = next.scenes.findIndex((s) => s.id === op.sceneId);
        if (idx === -1) {
          diagnostics.push(
            diagnostic(`${opPrefix}.sceneId`, `Unknown scene: ${op.sceneId}`),
          );
          break;
        }
        const updatedScenes = [...next.scenes];
        updatedScenes[idx] = {
          ...updatedScenes[idx]!,
          ...op.changes,
        };
        next = { ...next, scenes: updatedScenes };
        break;
      }

      case "removeScene": {
        const rmIdx = next.scenes.findIndex((s) => s.id === op.sceneId);
        if (rmIdx === -1) {
          diagnostics.push(
            diagnostic(
              `${opPrefix}.sceneId`,
              `Unknown scene: ${op.sceneId}`,
              "warning",
            ),
          );
          break;
        }
        // Remove the scene definition…
        const scenes = next.scenes.filter((s) => s.id !== op.sceneId);
        // …and any clips that reference it from visual tracks
        const visualTracks = next.timeline.visualTracks.map((track) => ({
          ...track,
          clips: track.clips.filter(
            (clip) =>
              !(
                clip.source.kind === "scene" &&
                clip.source.sceneId === op.sceneId
              ),
          ),
        }));
        // …and any bindings targeting this scene
        const bindings = next.bindings.filter(
          (b) =>
            !(b.target.kind === "scene" && b.target.sceneId === op.sceneId),
        );
        next = {
          ...next,
          scenes,
          timeline: { ...next.timeline, visualTracks },
          bindings,
        };
        break;
      }

      case "addVisualClip": {
        const trackIdx = next.timeline.visualTracks.findIndex(
          (t) => t.id === op.trackId,
        );
        if (trackIdx === -1) {
          diagnostics.push(
            diagnostic(
              `${opPrefix}.trackId`,
              `Unknown visual track: ${op.trackId}`,
            ),
          );
          break;
        }
        const track = next.timeline.visualTracks[trackIdx]!;
        if (track.clips.some((c) => c.id === op.clip.id)) {
          diagnostics.push(
            diagnostic(
              `${opPrefix}.clip.id`,
              `Clip already exists on track: ${op.clip.id}`,
            ),
          );
          break;
        }
        const newClips = [...track.clips];
        newClips.splice(op.insertAt ?? newClips.length, 0, op.clip);
        const newTracks = [...next.timeline.visualTracks];
        newTracks[trackIdx] = { ...track, clips: newClips };
        next = {
          ...next,
          timeline: { ...next.timeline, visualTracks: newTracks },
        };
        break;
      }

      case "trimVisualClip": {
        const trimTrackIdx = next.timeline.visualTracks.findIndex(
          (t) => t.id === op.trackId,
        );
        if (trimTrackIdx === -1) {
          diagnostics.push(
            diagnostic(
              `${opPrefix}.trackId`,
              `Unknown visual track: ${op.trackId}`,
            ),
          );
          break;
        }
        const trimTrack = next.timeline.visualTracks[trimTrackIdx]!;
        const clipIdx = trimTrack.clips.findIndex((c) => c.id === op.clipId);
        if (clipIdx === -1) {
          diagnostics.push(
            diagnostic(`${opPrefix}.clipId`, `Clip not found: ${op.clipId}`),
          );
          break;
        }
        const updatedClip = { ...trimTrack.clips[clipIdx]! };
        if (op.trimStart !== undefined) updatedClip.trimStart = op.trimStart;
        if (op.duration !== undefined) updatedClip.duration = op.duration;
        const trimClips = [...trimTrack.clips];
        trimClips[clipIdx] = updatedClip;
        const trimTracks = [...next.timeline.visualTracks];
        trimTracks[trimTrackIdx] = { ...trimTrack, clips: trimClips };
        next = {
          ...next,
          timeline: { ...next.timeline, visualTracks: trimTracks },
        };
        break;
      }

      case "moveVisualClip": {
        const fromIdx = next.timeline.visualTracks.findIndex(
          (t) => t.id === op.fromTrackId,
        );
        if (fromIdx === -1) {
          diagnostics.push(
            diagnostic(
              `${opPrefix}.fromTrackId`,
              `Unknown source track: ${op.fromTrackId}`,
            ),
          );
          break;
        }
        const toIdx = next.timeline.visualTracks.findIndex(
          (t) => t.id === op.toTrackId,
        );
        if (toIdx === -1) {
          diagnostics.push(
            diagnostic(
              `${opPrefix}.toTrackId`,
              `Unknown target track: ${op.toTrackId}`,
            ),
          );
          break;
        }
        const fromTrack = next.timeline.visualTracks[fromIdx]!;
        const clip = fromTrack.clips.find((c) => c.id === op.clipId);
        if (!clip) {
          diagnostics.push(
            diagnostic(
              `${opPrefix}.clipId`,
              `Clip not found on source track: ${op.clipId}`,
            ),
          );
          break;
        }
        const movedClip: VisualClipV1 = {
          ...clip,
          ...(op.start !== undefined ? { start: op.start } : {}),
        };
        const moveTracks = [...next.timeline.visualTracks];
        // Remove from source
        moveTracks[fromIdx] = {
          ...fromTrack,
          clips: fromTrack.clips.filter((c) => c.id !== op.clipId),
        };
        // Insert into target
        const targetTrack = moveTracks[toIdx]!;
        const targetClips = [...targetTrack.clips];
        targetClips.splice(op.insertAt ?? targetClips.length, 0, movedClip);
        moveTracks[toIdx] = { ...targetTrack, clips: targetClips };
        // Remove any tracks that became empty (min(1) clip constraint)
        const pruned = moveTracks.filter((t) => t.clips.length > 0);
        next = {
          ...next,
          timeline: { ...next.timeline, visualTracks: pruned },
        };
        break;
      }

      case "reorderVisualTrack": {
        const reorderIdx = next.timeline.visualTracks.findIndex(
          (t) => t.id === op.trackId,
        );
        if (reorderIdx === -1) {
          diagnostics.push(
            diagnostic(
              `${opPrefix}.trackId`,
              `Unknown visual track: ${op.trackId}`,
            ),
          );
          break;
        }
        const reorderTrack = next.timeline.visualTracks[reorderIdx]!;
        const clipById = new Map(reorderTrack.clips.map((c) => [c.id, c]));
        const missing = op.orderedClipIds.filter((id) => !clipById.has(id));
        if (missing.length > 0) {
          diagnostics.push(
            diagnostic(
              `${opPrefix}.orderedClipIds`,
              `Unknown clip ids: ${missing.join(", ")}`,
            ),
          );
          break;
        }
        const reordered = op.orderedClipIds.map((id) => clipById.get(id)!);
        const reorderTracks = [...next.timeline.visualTracks];
        reorderTracks[reorderIdx] = {
          ...reorderTrack,
          clips: reordered,
        };
        next = {
          ...next,
          timeline: { ...next.timeline, visualTracks: reorderTracks },
        };
        break;
      }

      case "addAsset":
      case "updateAsset": {
        const existingIdx = next.assets.findIndex((a) => a.id === op.asset.id);
        if (existingIdx >= 0) {
          if (op.op === "addAsset") {
            diagnostics.push(
              diagnostic(
                `${opPrefix}.asset.id`,
                `Asset already exists: ${op.asset.id}`,
              ),
            );
            break;
          }
          const updAssets = [...next.assets];
          updAssets[existingIdx] = op.asset;
          next = { ...next, assets: updAssets };
        } else {
          if (op.op === "updateAsset") {
            diagnostics.push(
              diagnostic(
                `${opPrefix}.asset.id`,
                `Asset not found: ${op.asset.id}`,
              ),
            );
            break;
          }
          next = { ...next, assets: [...next.assets, op.asset] };
        }
        break;
      }

      case "addVariable":
      case "updateVariable": {
        const varIdx = next.variables.findIndex((v) => v.id === op.variable.id);
        if (varIdx >= 0) {
          if (op.op === "addVariable") {
            diagnostics.push(
              diagnostic(
                `${opPrefix}.variable.id`,
                `Variable already exists: ${op.variable.id}`,
              ),
            );
            break;
          }
          const updVars = [...next.variables];
          updVars[varIdx] = op.variable;
          next = { ...next, variables: updVars };
        } else {
          if (op.op === "updateVariable") {
            diagnostics.push(
              diagnostic(
                `${opPrefix}.variable.id`,
                `Variable not found: ${op.variable.id}`,
              ),
            );
            break;
          }
          next = {
            ...next,
            variables: [...next.variables, op.variable],
          };
        }
        break;
      }

      case "addBinding":
      case "updateBinding": {
        const bindIdx = next.bindings.findIndex((b) => b.id === op.binding.id);
        if (bindIdx >= 0) {
          if (op.op === "addBinding") {
            diagnostics.push(
              diagnostic(
                `${opPrefix}.binding.id`,
                `Binding already exists: ${op.binding.id}`,
              ),
            );
            break;
          }
          const updBindings = [...next.bindings];
          updBindings[bindIdx] = op.binding;
          next = { ...next, bindings: updBindings };
        } else {
          if (op.op === "updateBinding") {
            diagnostics.push(
              diagnostic(
                `${opPrefix}.binding.id`,
                `Binding not found: ${op.binding.id}`,
              ),
            );
            break;
          }
          next = {
            ...next,
            bindings: [...next.bindings, op.binding],
          };
        }
        break;
      }

      case "addAudioTrack":
      case "updateAudioTrack": {
        const audioIdx = next.timeline.audioTracks.findIndex(
          (t) => t.id === op.audioTrack.id,
        );
        if (audioIdx >= 0) {
          if (op.op === "addAudioTrack") {
            diagnostics.push(
              diagnostic(
                `${opPrefix}.audioTrack.id`,
                `Audio track already exists: ${op.audioTrack.id}`,
              ),
            );
            break;
          }
          const updAudio = [...next.timeline.audioTracks];
          updAudio[audioIdx] = op.audioTrack;
          next = {
            ...next,
            timeline: {
              ...next.timeline,
              audioTracks: updAudio,
            },
          };
        } else {
          if (op.op === "updateAudioTrack") {
            diagnostics.push(
              diagnostic(
                `${opPrefix}.audioTrack.id`,
                `Audio track not found: ${op.audioTrack.id}`,
              ),
            );
            break;
          }
          next = {
            ...next,
            timeline: {
              ...next.timeline,
              audioTracks: [...next.timeline.audioTracks, op.audioTrack],
            },
          };
        }
        break;
      }

      case "addCaptionCue":
      case "updateCaptionCue": {
        const capIdx = next.timeline.captionTracks.findIndex(
          (t) => t.id === op.trackId,
        );
        if (capIdx === -1) {
          diagnostics.push(
            diagnostic(
              `${opPrefix}.trackId`,
              `Unknown caption track: ${op.trackId}`,
            ),
          );
          break;
        }
        const capTrack = next.timeline.captionTracks[capIdx]!;
        const tokenIdx = capTrack.tokens.findIndex((t) => t.id === op.token.id);
        const updCaps = [...next.timeline.captionTracks];
        if (tokenIdx >= 0) {
          if (op.op === "addCaptionCue") {
            diagnostics.push(
              diagnostic(
                `${opPrefix}.token.id`,
                `Caption token already exists: ${op.token.id}`,
              ),
            );
            break;
          }
          const updTokens = [...capTrack.tokens];
          updTokens[tokenIdx] = op.token;
          updCaps[capIdx] = { ...capTrack, tokens: updTokens };
        } else {
          if (op.op === "updateCaptionCue") {
            diagnostics.push(
              diagnostic(
                `${opPrefix}.token.id`,
                `Caption token not found: ${op.token.id}`,
              ),
            );
            break;
          }
          updCaps[capIdx] = {
            ...capTrack,
            tokens: [...capTrack.tokens, op.token],
          };
        }
        next = {
          ...next,
          timeline: { ...next.timeline, captionTracks: updCaps },
        };
        break;
      }

      case "setValue": {
        try {
          setValueAtPath(
            next as unknown as Record<string, unknown>,
            op.path,
            op.value,
          );
        } catch (err) {
          diagnostics.push(
            diagnostic(
              `${opPrefix}.path`,
              `Failed to set value at "${op.path}": ${String(err)}`,
            ),
          );
        }
        break;
      }
    }
  }

  // Final re-validation
  const validation = MotionProjectV1Schema.safeParse(next);
  if (!validation.success) {
    diagnostics.push(
      ...validation.error.issues.map((issue) => ({
        path: `(${issue.path.join(".")})`,
        message: `Post-patch validation: ${issue.message}`,
        severity: "error" as const,
      })),
    );
    return { project: null, diagnostics };
  }

  return { project: validation.data as MotionProjectV1, diagnostics };
}

// ── Internal helpers ──────────────────────────────────────────────────

function setValueAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let cursor: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (cursor[part] === undefined || cursor[part] === null) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  if (last !== undefined) cursor[last] = value;
}
