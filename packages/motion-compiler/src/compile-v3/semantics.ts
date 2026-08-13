import { V3 } from "@motionvideo/motion-protocol";
import { isCompiledPreset } from "../preset-registry";
import type { DiagnosticCollector } from "../compile-result";
import type { JsonRecord } from "./helpers";

/**
 * Detect cycles in clip schedules (after/with chains).
 * Returns the ids of clips participating in a cycle.
 */
export function detectScheduleCycles(
  clips: Array<{ id: string; schedule: { kind: string; clipId?: string } }>,
): string[] {
  const graph = new Map<string, string[]>();
  for (const clip of clips) {
    const deps: string[] = [];
    if (
      (clip.schedule.kind === "after" || clip.schedule.kind === "with") &&
      clip.schedule.clipId
    ) {
      deps.push(clip.schedule.clipId);
    }
    graph.set(clip.id, deps);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles: string[] = [];
  const dfs = (id: string): void => {
    if (visiting.has(id)) {
      cycles.push(id);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of graph.get(id) ?? []) {
      if (graph.has(dep)) dfs(dep);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of graph.keys()) dfs(id);
  return [...new Set(cycles)];
}

function expectedVariableTypeForPropKind(kind: string): string | undefined {
  switch (kind) {
    case "text":
    case "choice":
      return "string";
    case "color":
      return "color";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "asset":
      return "asset";
    default:
      return undefined;
  }
}

function expectedVariableTypeForProperty(property: string): string | undefined {
  // Exact segment matching — avoid false positives from substring matches.
  const segments = property.toLowerCase().split(".");
  const last = segments[segments.length - 1];
  if (!last) return undefined;
  if (last === "text" || last === "label" || last === "name") return "string";
  if (last.includes("color")) return "color";
  if (
    last === "visible" ||
    last === "enabled" ||
    last === "muted" ||
    last === "loop"
  )
    return "boolean";
  if (
    /^(?:opacity|width|height|scalex|scaley|rotation|x|y|z|fontsize|letterspacing|lineheight|rate|volume|duration|start|end|progress|radius|length|fov|zoom|near|far)$/.test(
      last,
    ) ||
    segments.some((s) =>
      /^(?:opacity|width|height|scale|rotation|fontsize)$/.test(s),
    )
  )
    return "number";
  if (last === "assetid") return "asset";
  return undefined;
}

export function validateV3Semantics(
  project: V3.MotionProjectV3,
  collector: DiagnosticCollector,
): void {
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  const variableIds = new Set(project.variables.map((variable) => variable.id));
  const componentById = new Map(
    project.components.map((component) => [component.id, component] as const),
  );

  // ── Bindings ──
  for (const binding of project.bindings) {
    if (!variableIds.has(binding.source.variableId)) {
      collector.error(
        "CMP_UNRESOLVED_VARIABLE",
        `Binding "${binding.id}" references unknown variable "${binding.source.variableId}"`,
        {
          path: ["bindings", binding.id],
          details: {
            bindingId: binding.id,
            variableId: binding.source.variableId,
          },
        },
      );
      continue;
    }
    const variable = project.variables.find(
      (candidate) => candidate.id === binding.source.variableId,
    )!;
    // Resolve the property path a binding targets, then type-check the
    // bound variable against it.
    const target = binding.target;
    if (target.kind === "component") {
      const component = project.components.find(
        (c) => c.id === target.componentId,
      );
      if (!component) continue;
      const prop = component.props.find((p) => p.id === target.propId);
      if (!prop) continue;
      const expected = expectedVariableTypeForPropKind(prop.kind);
      if (expected && variable.type !== expected) {
        collector.error(
          "CMP_BINDING_TYPE_MISMATCH",
          `Binding "${binding.id}" binds ${variable.type} variable "${variable.id}" to component "${target.componentId}" prop "${target.propId}" which expects ${expected}`,
          {
            path: ["bindings", binding.id],
            details: {
              bindingId: binding.id,
              variableType: variable.type,
              componentId: target.componentId,
              propId: target.propId,
              expected,
            },
          },
        );
      }
    } else if (target.kind === "componentLayer") {
      const scene = project.scenes.find(
        (candidate) => candidate.id === target.sceneId,
      );
      const node = scene?.layers.find(
        (candidate) => candidate.id === target.layerId,
      );
      const component =
        node?.type === "component"
          ? project.components.find(
              (candidate) => candidate.id === node.payload.componentId,
            )
          : undefined;
      const prop = component?.props.find((p) => p.id === target.propId);
      if (!prop) continue;
      const expected = expectedVariableTypeForPropKind(prop.kind);
      if (expected && variable.type !== expected) {
        collector.error(
          "CMP_BINDING_TYPE_MISMATCH",
          `Binding "${binding.id}" binds ${variable.type} variable "${variable.id}" to component node "${target.layerId}" prop "${target.propId}" which expects ${expected}`,
          {
            path: ["bindings", binding.id],
            details: {
              bindingId: binding.id,
              variableType: variable.type,
              componentId: component?.id,
              propId: target.propId,
              expected,
            },
          },
        );
      }
    } else {
      const expected = expectedVariableTypeForProperty(target.property);
      if (expected && variable.type !== expected) {
        collector.error(
          "CMP_BINDING_TYPE_MISMATCH",
          `Binding "${binding.id}" binds ${variable.type} variable "${variable.id}" to "${target.property}" which expects ${expected}`,
          {
            path: ["bindings", binding.id],
            details: {
              bindingId: binding.id,
              variableType: variable.type,
              property: target.property,
              expected,
            },
          },
        );
      }
    }
  }

  // ── Scenes: clip targets, presets, asset refs, schedule cycles ──
  for (const scene of project.scenes) {
    const layerIds = new Set(scene.layers.map((node) => node.id));
    const assetRefs: Array<{ layerId: string; assetId: string }> = [];
    for (const node of scene.layers) {
      const payload = node.payload as JsonRecord;
      if (
        (node.type === "image" ||
          node.type === "svg" ||
          node.type === "video") &&
        typeof payload.assetId === "string"
      ) {
        assetRefs.push({ layerId: node.id, assetId: payload.assetId });
      }
      if (node.type === "text" && node.payload.fontAssetId) {
        assetRefs.push({ layerId: node.id, assetId: node.payload.fontAssetId });
      }
      if (node.type === "component") {
        const component = componentById.get(node.payload.componentId);
        if (!component) {
          collector.error(
            "CMP_UNRESOLVED_COMPONENT",
            `Scene "${scene.id}" node "${node.id}" references unknown component "${node.payload.componentId}"`,
            {
              path: ["scenes", scene.id, "layers", node.id],
              details: {
                sceneId: scene.id,
                layerId: node.id,
                componentId: node.payload.componentId,
              },
            },
          );
        } else if (
          node.payload.variantId &&
          !component.variants.some((v) => v.id === node.payload.variantId)
        ) {
          collector.error(
            "CMP_UNRESOLVED_COMPONENT_VARIANT",
            `Scene "${scene.id}" node "${node.id}" references unknown variant "${node.payload.variantId}" on component "${component.id}"`,
            {
              path: ["scenes", scene.id, "layers", node.id],
              details: {
                sceneId: scene.id,
                layerId: node.id,
                componentId: component.id,
                variantId: node.payload.variantId,
              },
            },
          );
        }
      }
    }
    for (const ref of assetRefs) {
      if (!assetIds.has(ref.assetId)) {
        collector.error(
          "CMP_UNRESOLVED_ASSET",
          `Scene "${scene.id}" node "${ref.layerId}" references unknown asset "${ref.assetId}"`,
          {
            path: ["scenes", scene.id, "layers", ref.layerId],
            details: {
              sceneId: scene.id,
              layerId: ref.layerId,
              assetId: ref.assetId,
            },
          },
        );
      }
    }
    for (const clip of scene.clips ?? []) {
      if (clip.layerId && !layerIds.has(clip.layerId)) {
        collector.error(
          "CMP_CLIP_TARGET_MISSING",
          `Scene "${scene.id}" clip "${clip.id}" references unknown node "${clip.layerId}"`,
          {
            path: ["scenes", scene.id, "clips", clip.id],
            details: {
              sceneId: scene.id,
              clipId: clip.id,
              layerId: clip.layerId,
            },
          },
        );
      }
      if (
        clip.source.kind === "preset" &&
        !isCompiledPreset(clip.source.presetId)
      ) {
        collector.error(
          "CMP_UNRESOLVED_PRESET",
          `Scene "${scene.id}" clip "${clip.id}" references unknown preset "${clip.source.presetId}"`,
          {
            path: ["scenes", scene.id, "clips", clip.id],
            details: {
              sceneId: scene.id,
              clipId: clip.id,
              presetId: clip.source.presetId,
            },
          },
        );
      }
    }
    const cycles = detectScheduleCycles(scene.clips ?? []);
    for (const clipId of cycles) {
      collector.error(
        "CMP_CYCLE_DETECTED",
        `Scene "${scene.id}" clip schedule contains a cycle involving "${clipId}"`,
        {
          path: ["scenes", scene.id, "clips", clipId],
          details: { sceneId: scene.id, clipId },
        },
      );
    }
  }

  // ── Visual tracks ──
  const sceneIds = new Set(project.scenes.map((scene) => scene.id));
  for (const track of project.timeline.visualTracks) {
    for (const clip of track.clips) {
      if (!sceneIds.has(clip.source.sceneId)) {
        collector.error(
          "CMP_CLIP_TARGET_MISSING",
          `Visual clip "${clip.id}" references unknown scene "${clip.source.sceneId}"`,
          {
            path: ["timeline", "visualTracks", track.id, "clips", clip.id],
            details: { clipId: clip.id, sceneId: clip.source.sceneId },
          },
        );
      }
    }
  }

  // ── Audio clips: asset refs ──
  for (const track of project.timeline.audioTracks) {
    for (const clip of track.clips) {
      if (!assetIds.has(clip.assetId)) {
        collector.error(
          "CMP_UNRESOLVED_ASSET",
          `Audio clip "${clip.id}" on track "${track.id}" references unknown asset "${clip.assetId}"`,
          {
            path: ["timeline", "audioTracks", track.id, "clips", clip.id],
            details: {
              trackId: track.id,
              clipId: clip.id,
              assetId: clip.assetId,
            },
          },
        );
      }
    }
  }

  // ── Component dependency integrity ──
  const embeddedByKey = new Map(
    project.components.map(
      (component) =>
        [`${component.id}@${component.version}`, component] as const,
    ),
  );
  for (const dep of project.dependencies.components) {
    const embedded = embeddedByKey.get(`${dep.componentId}@${dep.version}`);
    if (!embedded) {
      // Dependency without an embedded definition — only a problem when a
      // visual clip actually instantiates it (checked above). If the dep is
      // unused, the compiler can still proceed.
      continue;
    }
    if (
      dep.integrity &&
      embedded.integrity &&
      dep.integrity !== embedded.integrity
    ) {
      collector.error(
        "CMP_COMPONENT_INTEGRITY_MISMATCH",
        `Component "${dep.componentId}@${dep.version}" integrity mismatch: dependency declares "${dep.integrity}", embedded definition has "${embedded.integrity}"`,
        {
          path: ["dependencies", "components", dep.componentId],
          details: {
            componentId: dep.componentId,
            version: dep.version,
            declaredIntegrity: dep.integrity,
            embeddedIntegrity: embedded.integrity,
          },
        },
      );
    }
  }
}
