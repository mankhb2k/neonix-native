/**
 * Property command dispatcher — mỏng. Route từng DocumentPropertyCommand sang
 * command family (node-patches / target-apply / keyframe-commands) và gom kết quả
 * qua finalizePropertyMutation (cổng protocol duy nhất). Validation tối thiểu theo
 * từng command; patch/traversal/keyframe logic nằm ở family module tương ứng.
 */
import { MOTION_PROTOCOL_LIMITS } from "@motionvideo/motion-protocol";
import type { TimelineDocument } from "../document/document";
import type {
  DocumentPropertyCommand,
  PropertyCommandResult,
  PropertyDomainEvent,
} from "./property-commands";
import {
  collectNonFinite,
  finalizePropertyMutation,
  rejectedEmptyTargets,
  rejectedInvalid,
  type PropertyApplyResult,
} from "./property-runner-state";
import {
  applyEffects,
  applyMedia,
  applyMetadata,
  applyOpacity,
  applyStyle,
  applyText,
  applyTiming,
  applyTransformPatch,
} from "./node-patches";
import {
  applyAudioTrack,
  applyReorderSceneNodes,
  applyToCompatibleTargets,
  applyToTargets,
} from "./target-apply";
import {
  applyKeyframe,
  deleteKeyframes,
  moveKeyframes,
  setKeyframesEasing,
} from "./keyframe-commands";

export type { PropertyCommandResult } from "./property-commands";

export function executePropertyCommand(
  document: TimelineDocument,
  command: DocumentPropertyCommand,
): PropertyCommandResult {
  if (!document.project) {
    return {
      status: "rejected",
      reason: "no_project",
      message: "No project loaded.",
    };
  }

  let result: PropertyApplyResult;
  let events: PropertyDomainEvent[];

  switch (command.type) {
    case "reorder-scene-layers": {
      if (!command.sceneId.trim())
        return rejectedInvalid("Scene id is required.");
      if (!command.layerIds.length) {
        return rejectedEmptyTargets("No node ids for reorder.");
      }
      result = applyReorderSceneNodes(
        document.project,
        command.sceneId,
        command.layerIds,
      );
      events = [
        {
          type: "scene-layers-reordered",
          sceneId: command.sceneId,
          layerIds: command.layerIds,
        },
      ];
      break;
    }
    case "set-node-transform": {
      if (!command.targets.length) return rejectedEmptyTargets();
      if (
        command.patch.x === undefined &&
        command.patch.y === undefined &&
        command.patch.rotation === undefined &&
        command.patch.scaleX === undefined &&
        command.patch.scaleY === undefined
      ) {
        return rejectedInvalid("Empty transform patch.");
      }
      if (
        collectNonFinite([
          command.patch.x,
          command.patch.y,
          command.patch.rotation,
          command.patch.scaleX,
          command.patch.scaleY,
        ])
      ) {
        return rejectedInvalid("Transform values must be finite numbers.");
      }
      result = applyToTargets(document.project, command.targets, (node) =>
        applyTransformPatch(node, command.patch),
      );
      events = [{ type: "node-transform-changed", targets: command.targets }];
      break;
    }
    case "set-node-opacity": {
      if (!command.targets.length) return rejectedEmptyTargets();
      if (!Number.isFinite(command.opacity)) {
        return rejectedInvalid("Opacity must be a finite number.");
      }
      result = applyToTargets(document.project, command.targets, (node) =>
        applyOpacity(node, command.opacity),
      );
      events = [{ type: "node-opacity-changed", targets: command.targets }];
      break;
    }
    case "set-node-metadata": {
      if (!command.targets.length) return rejectedEmptyTargets();
      if (
        command.patch.name === undefined &&
        command.patch.visible === undefined
      ) {
        return rejectedInvalid("Empty metadata patch.");
      }
      result = applyToTargets(document.project, command.targets, (node) =>
        applyMetadata(node, command.patch),
      );
      events = [{ type: "node-metadata-changed", targets: command.targets }];
      break;
    }
    case "set-node-style": {
      if (!command.targets.length) return rejectedEmptyTargets();
      if (
        command.patch.fill === undefined &&
        command.patch.fillOpacity === undefined &&
        command.patch.stroke === undefined &&
        command.patch.strokeWidth === undefined &&
        command.patch.strokeOpacity === undefined
      ) {
        return rejectedInvalid("Empty style patch.");
      }
      if (
        collectNonFinite([
          command.patch.fillOpacity,
          command.patch.strokeWidth,
          command.patch.strokeOpacity,
        ])
      ) {
        return rejectedInvalid("Style numeric values must be finite.");
      }
      result = applyToCompatibleTargets(
        document.project,
        command.targets,
        (node) => applyStyle(node, command.patch),
      );
      if (result.incompatible) {
        return rejectedInvalid("One or more targets do not support style.");
      }
      events = [{ type: "node-style-changed", targets: command.targets }];
      break;
    }
    case "set-node-text": {
      if (!command.targets.length) return rejectedEmptyTargets();
      if (
        collectNonFinite([
          command.patch.fontSize,
          command.patch.fontWeight,
          command.patch.lineHeight,
          command.patch.letterSpacing,
        ])
      ) {
        return rejectedInvalid("Text numeric values must be finite.");
      }
      result = applyToCompatibleTargets(
        document.project,
        command.targets,
        (node) => applyText(node, command.patch),
      );
      if (result.incompatible) {
        return rejectedInvalid("One or more targets are not text layers.");
      }
      events = [{ type: "node-text-changed", targets: command.targets }];
      break;
    }
    case "set-node-media": {
      if (!command.targets.length) return rejectedEmptyTargets();
      if (command.patch.fit === undefined && command.patch.crop === undefined) {
        return rejectedInvalid("Empty media patch.");
      }
      if (
        command.patch.crop &&
        collectNonFinite([
          command.patch.crop.x,
          command.patch.crop.y,
          command.patch.crop.width,
          command.patch.crop.height,
        ])
      ) {
        return rejectedInvalid("Crop values must be finite numbers.");
      }
      result = applyToCompatibleTargets(
        document.project,
        command.targets,
        (node) => applyMedia(node, command.patch),
      );
      if (result.incompatible) {
        return rejectedInvalid(
          "One or more targets do not support media payload.",
        );
      }
      events = [{ type: "node-media-changed", targets: command.targets }];
      break;
    }
    case "set-audio-track": {
      if (
        command.patch.volume === undefined &&
        command.patch.fadeIn === undefined &&
        command.patch.fadeOut === undefined
      ) {
        return rejectedInvalid("Empty audio patch.");
      }
      if (
        "speed" in command.patch &&
        (command.patch as { speed?: unknown }).speed !== undefined
      ) {
        return rejectedInvalid("AudioTrack has no speed field; rejected.");
      }
      if (
        collectNonFinite([
          command.patch.volume,
          command.patch.fadeIn,
          command.patch.fadeOut,
        ])
      ) {
        return rejectedInvalid("Audio values must be finite numbers.");
      }
      result = applyAudioTrack(document.project, command.audioTrackId, command);
      events = [
        { type: "audio-track-changed", audioTrackId: command.audioTrackId },
      ];
      break;
    }
    case "set-node-effects": {
      if (!command.targets.length) return rejectedEmptyTargets();
      if (command.patch.op === "upsert-blur") {
        if (!command.patch.effectId?.trim()) {
          return rejectedInvalid("Effect id is required.");
        }
        if (!Number.isFinite(command.patch.radius)) {
          return rejectedInvalid("Blur radius must be a finite number.");
        }
      }
      result = applyToTargets(document.project, command.targets, (node) =>
        applyEffects(node, command.patch),
      );
      events = [{ type: "node-effects-changed", targets: command.targets }];
      break;
    }
    case "set-node-timing": {
      if (!command.targets.length) return rejectedEmptyTargets();
      if (
        collectNonFinite([command.timing.start, command.timing.duration]) ||
        command.timing.duration <= 0 ||
        command.timing.start < 0
      ) {
        return rejectedInvalid(
          "Node timing requires finite start >= 0 and positive duration.",
        );
      }
      result = applyToTargets(document.project, command.targets, (node) =>
        applyTiming(node, command.timing),
      );
      events = [{ type: "node-timing-changed", targets: command.targets }];
      break;
    }
    case "set-property-keyframe": {
      if (!command.targets.length) return rejectedEmptyTargets();
      if (!command.property.trim()) {
        return rejectedInvalid("Keyframe property path required.");
      }
      if (!Number.isFinite(command.t)) {
        return rejectedInvalid("Keyframe time must be a finite number.");
      }
      if (
        command.t < 0 ||
        command.t > MOTION_PROTOCOL_LIMITS.mediaDurationSeconds
      ) {
        return rejectedInvalid(
          `Keyframe time must be within 0..${MOTION_PROTOCOL_LIMITS.mediaDurationSeconds}.`,
        );
      }
      if (typeof command.v === "number" && !Number.isFinite(command.v)) {
        return rejectedInvalid("Keyframe value must be finite when numeric.");
      }
      result = applyKeyframe(document.project, command);
      if (result.invalid) return rejectedInvalid(result.invalid);
      events = [
        {
          type: "property-keyframe-changed",
          targets: command.targets,
          property: command.property,
        },
      ];
      break;
    }
    case "move-property-keyframe": {
      if (!command.targets.length) {
        return rejectedEmptyTargets("No targets specified.");
      }
      if (!Number.isFinite(command.newT)) {
        return rejectedInvalid("New time must be finite.");
      }
      if (
        command.newT < 0 ||
        command.newT > MOTION_PROTOCOL_LIMITS.mediaDurationSeconds
      ) {
        return rejectedInvalid("New time out of bounds.");
      }
      if (typeof command.newV === "number" && !Number.isFinite(command.newV)) {
        return rejectedInvalid("Numeric value must be finite.");
      }
      result = moveKeyframes(document.project, command);
      if (result.invalid) return rejectedInvalid(result.invalid);
      events = [
        {
          type: "property-keyframe-changed",
          targets: command.targets,
          property: command.property,
        },
      ];
      break;
    }
    case "delete-property-keyframe": {
      if (!command.targets.length) {
        return rejectedEmptyTargets("No targets specified.");
      }
      result = deleteKeyframes(document.project, command);
      events = [
        {
          type: "property-keyframe-changed",
          targets: command.targets,
          property: command.property,
        },
      ];
      break;
    }
    case "set-keyframe-easing": {
      if (!command.targets.length) {
        return rejectedEmptyTargets("No targets specified.");
      }
      result = setKeyframesEasing(document.project, command);
      events = [
        {
          type: "property-keyframe-changed",
          targets: command.targets,
          property: command.property,
        },
      ];
      break;
    }
    default: {
      const _exhaustive: never = command;
      return {
        status: "rejected",
        reason: "invalid_value",
        message: `Unknown command: ${JSON.stringify(_exhaustive)}`,
      };
    }
  }

  if (result.missing) {
    return {
      status: "rejected",
      reason: "missing_node",
      message: "One or more targets were not found.",
    };
  }

  return finalizePropertyMutation(result.project, document, events);
}
