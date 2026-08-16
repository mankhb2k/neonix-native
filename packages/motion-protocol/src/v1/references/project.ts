/**
 * Validate reference toàn project V1.
 */
/**
 * V1 project-wide reference validation.
 */
import {
  isLayerPropertyAnimatable,
  isLayerPropertyBindable,
  motionLiteralMatchesValueKind,
  motionPropKindFitsValueKind,
  motionPropertyCapability,
} from "../../capabilities";
import type { MotionProjectV1 } from "../project";
import type { LayerV1 } from "../layers";
import { flattenLayerTree } from "../layers";
import type { ProjectVariableV1 } from "../variables";
import {
  isOwnerPropSink,
  variableTypeMatchesPropKind,
} from "../prop-sinks";
import {
  defaultAnimatableForPropKind,
  defaultInterpolationForPropKind,
  type ComponentPropV1,
} from "../components";
import {
  defaultInterpolationForValueKind,
  allowedInterpolationsForValueKind,
} from "../animation/interpolation";
import { duplicates } from "./helpers";
import { isPropKeyframesValue } from "../components/prop-values";
import { validateLayerGraphV1 } from "./layer-graph";
import { validateLayerAssetsV1 } from "./layer-assets";
import type { ReferenceIssue } from "./types";

/** Binding path phải `bindable` trên capability table — không whitelist riêng. */
function isPropBindingPropertyValid(layer: LayerV1, property: string): boolean {
  return isLayerPropertyBindable(layer.type, property);
}

function isPropAnimatable(prop: ComponentPropV1): boolean {
  return prop.animatable ?? defaultAnimatableForPropKind(prop.kind);
}

function validateTimelineClips(
  clips: NonNullable<MotionProjectV1["timeline"]["clips"]>,
  layerById: Map<string, LayerV1>,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  for (const [index, clip] of clips.entries()) {
    const path = `timeline.clips.${index}`;
    const layer = layerById.get(clip.layerId);
    if (!layer) {
      issues.push({
        path: `${path}.layerId`,
        message: `Unknown layer: ${clip.layerId}`,
      });
      continue;
    }
    if (clip.property.startsWith("payload.props.")) {
      issues.push({
        path: `${path}.property`,
        message:
          "Component prop keyframes belong on payload.props.<propId>, not timeline.clips",
      });
      continue;
    }
    if (!isLayerPropertyAnimatable(layer.type, clip.property)) {
      issues.push({
        path: `${path}.property`,
        message: `Property "${clip.property}" is not animatable on ${layer.type} layer "${layer.id}"`,
      });
      continue;
    }
    const capability = motionPropertyCapability(layer.type, clip.property);
    const valueKind = capability?.valueKind ?? "json";
    const interpolation =
      clip.interpolation ?? defaultInterpolationForValueKind(valueKind);
    if (!allowedInterpolationsForValueKind(valueKind).has(interpolation)) {
      issues.push({
        path: `${path}.interpolation`,
        message: `interpolation "${interpolation}" is invalid for ${clip.property} (${valueKind})`,
      });
    }
    let prevT: number | undefined;
    for (let i = 0; i < clip.keys.length; i++) {
      const key = clip.keys[i]!;
      if (prevT !== undefined) {
        if (key.t === prevT) {
          issues.push({
            path: `${path}.keys.${i}.t`,
            message: `clip "${clip.id}" must not duplicate t=${key.t}`,
          });
        } else if (key.t < prevT) {
          issues.push({
            path: `${path}.keys.${i}.t`,
            message: `clip "${clip.id}" keys must be sorted by increasing t`,
          });
        }
      }
      prevT = key.t;
      if (key.t > layer.timing.duration) {
        issues.push({
          path: `${path}.keys.${i}.t`,
          message: `clip "${clip.id}" keyframe t=${key.t} exceeds layer duration ${layer.timing.duration}`,
        });
      }
      if (!motionLiteralMatchesValueKind(valueKind, key.value)) {
        issues.push({
          path: `${path}.keys.${i}.value`,
          message: `clip "${clip.id}" key value is incompatible with ${clip.property} (${valueKind})`,
        });
      }
    }
  }
  return issues;
}

function assetTypeMatchesAssetKind(
  assetType: string,
  assetKind: string,
): boolean {
  if (assetKind === "media") {
    return assetType === "image" || assetType === "video";
  }
  return assetType === assetKind;
}

function literalMatchesPropKind(value: unknown, propKind: string): boolean {
  switch (propKind) {
    case "string":
    case "color":
    case "asset":
    case "choice":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    default:
      return true;
  }
}

function propKindsCompatible(parentKind: string, childKind: string): boolean {
  return parentKind === childKind;
}

function allowedKeyframeInterpolations(propKind: string): Set<string> {
  return new Set(allowedInterpolationsForValueKind(propKind));
}

type AssetLike = { id: string; assetType: string };

function validateAssetIdForProp(
  assetId: string,
  prop: ComponentPropV1,
  assetById: Map<string, AssetLike> | undefined,
  path: string,
): ReferenceIssue[] {
  if (!assetById) return [];
  const asset = assetById.get(assetId);
  if (!asset) {
    return [
      {
        path,
        message: `props "${prop.id}" references unknown asset "${assetId}"`,
      },
    ];
  }
  if (
    prop.assetKind &&
    !assetTypeMatchesAssetKind(asset.assetType, prop.assetKind)
  ) {
    return [
      {
        path,
        message: `props "${prop.id}" asset "${assetId}" has type "${asset.assetType}", expected assetKind "${prop.assetKind}"`,
      },
    ];
  }
  return [];
}

function validateVariableAgainstProp(
  variable: ProjectVariableV1,
  prop: ComponentPropV1,
  assetById: Map<string, AssetLike> | undefined,
  path: string,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  if (!variableTypeMatchesPropKind(variable.type, prop.kind)) {
    issues.push({
      path,
      message: `props "${prop.id}" references variable "${variable.id}" of type "${variable.type}", expected kind "${prop.kind}"`,
    });
    return issues;
  }

  if (prop.kind === "choice" && prop.options) {
    if (variable.type === "choice") {
      const extra = variable.options.filter(
        (option) => !prop.options!.includes(option),
      );
      if (extra.length > 0) {
        issues.push({
          path,
          message: `props "${prop.id}" choice variable "${variable.id}" has options not in prop options: ${extra.join(", ")}`,
        });
      }
      if (!prop.options.includes(variable.value)) {
        issues.push({
          path,
          message: `props "${prop.id}" choice variable "${variable.id}" value "${variable.value}" is not in options`,
        });
      }
    } else if (
      variable.type === "string" &&
      !prop.options.includes(variable.value)
    ) {
      issues.push({
        path,
        message: `props "${prop.id}" string variable "${variable.id}" value "${variable.value}" is not in options`,
      });
    }
  }

  if (prop.kind === "asset" && variable.type === "asset") {
    if (
      prop.assetKind &&
      !assetTypeMatchesAssetKind(variable.assetKind, prop.assetKind)
    ) {
      issues.push({
        path,
        message: `props "${prop.id}" asset variable "${variable.id}" has assetKind "${variable.assetKind}", expected "${prop.assetKind}"`,
      });
    }
    issues.push(
      ...validateAssetIdForProp(variable.value, prop, assetById, path),
    );
  }

  return issues;
}

function validatePropValue(
  value: unknown,
  prop: ComponentPropV1,
  assetById: Map<string, AssetLike> | undefined,
  path: string,
  propDuration?: number,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];

  if (isPropKeyframesValue(value)) {
    if (!isPropAnimatable(prop)) {
      issues.push({
        path,
        message: `Prop "${prop.id}" is not animatable; keyframes are not allowed`,
      });
      return issues;
    }
    const allowed = allowedKeyframeInterpolations(prop.kind);
    const interpolation =
      value.interpolation ?? defaultInterpolationForPropKind(prop.kind);
    if (!allowed.has(interpolation)) {
      issues.push({
        path,
        message: `Prop "${prop.id}" keyframes interpolation "${interpolation}" is invalid for kind "${prop.kind}"`,
      });
    }
    let prevT: number | undefined;
    for (let i = 0; i < value.keys.length; i++) {
      const key = value.keys[i]!;
      if (prevT !== undefined) {
        if (key.t === prevT) {
          issues.push({
            path: `${path}.keys.${i}.t`,
            message: `Prop "${prop.id}" keyframes must not duplicate t=${key.t}`,
          });
        } else if (key.t < prevT) {
          issues.push({
            path: `${path}.keys.${i}.t`,
            message: `Prop "${prop.id}" keyframes must be sorted by increasing t`,
          });
        }
      }
      prevT = key.t;
      if (propDuration !== undefined && key.t > propDuration) {
        issues.push({
          path: `${path}.keys.${i}.t`,
          message: `Prop "${prop.id}" keyframe t=${key.t} exceeds component layer duration ${propDuration}`,
        });
      }
      issues.push(
        ...validatePropValue(
          key.value,
          prop,
          assetById,
          `${path}.keys.${i}.value`,
        ),
      );
    }
    return issues;
  }

  if (!literalMatchesPropKind(value, prop.kind)) {
    issues.push({
      path,
      message: `props "${prop.id}" value is incompatible with expected kind "${prop.kind}"`,
    });
    return issues;
  }

  if (prop.kind === "choice" && prop.options && typeof value === "string") {
    if (!prop.options.includes(value)) {
      issues.push({
        path,
        message: `props "${prop.id}" value "${value}" is not in options`,
      });
    }
  }

  if (prop.kind === "asset" && typeof value === "string") {
    issues.push(...validateAssetIdForProp(value, prop, assetById, path));
  }

  return issues;
}

function collectDirectChildComponentIds(
  layers: LayerV1[],
): Array<{ layerId: string; componentId: string }> {
  return layers
    .filter(
      (layer): layer is Extract<LayerV1, { type: "component" }> =>
        layer.type === "component",
    )
    .map((layer) => ({
      layerId: layer.id,
      componentId: layer.payload.componentId,
    }));
}

function detectComponentCycles(
  componentById: Map<string, import("../components").ComponentDefinitionV1>,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(componentId: string, stack: string[]): void {
    if (visited.has(componentId)) return;
    if (visiting.has(componentId)) {
      issues.push({
        path: `components.${componentId}`,
        message: `Component cycle detected: ${[...stack, componentId].join(" → ")}`,
      });
      return;
    }
    visiting.add(componentId);
    const component = componentById.get(componentId);
    if (component) {
      for (const child of collectDirectChildComponentIds(
        flattenLayerTree(component.layers),
      )) {
        dfs(child.componentId, [...stack, componentId]);
      }
    }
    visiting.delete(componentId);
    visited.add(componentId);
  }

  for (const componentId of componentById.keys()) {
    dfs(componentId, []);
  }
  return issues;
}

/**
 * Kiểm tra instance `type: "component"` trên một cây layer.
 * `payload.props` là literal hoặc keyframes — không inline variable ref.
 */
function validateComponentLayerReferences(
  layers: LayerV1[],
  componentById: Map<string, import("../components").ComponentDefinitionV1>,
  assetById: Map<string, AssetLike>,
  pathPrefix: string,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  for (const layer of layers) {
    if (layer.type !== "component") continue;
    const path = `${pathPrefix}.${layer.id}`;
    const component = componentById.get(layer.payload.componentId);
    if (!component) {
      issues.push({
        path: `${path}.payload.componentId`,
        message: `Component layer "${layer.id}" references unknown component: ${layer.payload.componentId}`,
      });
      continue;
    }
    if (
      layer.payload.variantId !== undefined &&
      !component.variants.some((v) => v.id === layer.payload.variantId)
    ) {
      issues.push({
        path: `${path}.payload.variantId`,
        message: `Component "${component.id}" does not declare variant "${layer.payload.variantId}"`,
      });
    }
    const propById = new Map(component.props.map((p) => [p.id, p] as const));
    for (const [propId, value] of Object.entries(layer.payload.props ?? {})) {
      const prop = propById.get(propId);
      if (!prop) {
        issues.push({
          path: `${path}.payload.props.${propId}`,
          message: `Component "${component.id}" does not declare prop "${propId}"`,
        });
        continue;
      }
      issues.push(
        ...validatePropValue(
          value,
          prop,
          assetById,
          `${path}.payload.props.${propId}`,
          layer.timing.duration,
        ),
      );
    }
  }
  return issues;
}

export function validateMotionProjectV1References(
  project: MotionProjectV1,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const projectLayers = flattenLayerTree(project.layers);
  const layerById = new Map(projectLayers.map((layer) => [layer.id, layer]));
  const componentById = new Map(
    project.components.map((component) => [component.id, component]),
  );
  const variableIds = new Set(project.variables.map((variable) => variable.id));
  // Lookup consumer: instance trên project.layers chỉ được ref map này.
  const projectVariableById = new Map(
    project.variables.map((variable) => [variable.id, variable] as const),
  );
  const assetById = new Map(project.assets.map((asset) => [asset.id, asset]));

  for (const id of new Set(
    duplicates(projectLayers.map((layer) => layer.id)),
  )) {
    issues.push({ path: "layers", message: `Duplicate layer id: ${id}` });
  }
  for (const id of new Set(duplicates(project.variables.map((v) => v.id)))) {
    issues.push({ path: "variables", message: `Duplicate variable id: ${id}` });
  }
  for (const id of new Set(duplicates(project.assets.map((a) => a.id)))) {
    issues.push({ path: "assets", message: `Duplicate asset id: ${id}` });
  }
  for (const id of new Set(duplicates(project.bindings.map((b) => b.id)))) {
    issues.push({ path: "bindings", message: `Duplicate binding id: ${id}` });
  }
  for (const id of new Set(duplicates(project.components.map((c) => c.id)))) {
    issues.push({
      path: "components",
      message: `Duplicate component id: ${id}`,
    });
  }
  for (const id of new Set(
    duplicates((project.timeline.clips ?? []).map((clip) => clip.id)),
  )) {
    issues.push({
      path: "timeline.clips",
      message: `Duplicate clip id: ${id}`,
    });
  }

  issues.push(
    ...validateTimelineClips(project.timeline.clips ?? [], layerById),
  );

  for (const binding of project.bindings) {
    const path = `bindings.${binding.id}`;
    const bindingTarget = binding.target;
    if (!variableIds.has(binding.source.variableId)) {
      issues.push({
        path: `${path}.source.variableId`,
        message: `Unknown variable: ${binding.source.variableId}`,
      });
    }
    const layer = layerById.get(bindingTarget.layerId);
    if (!layer) {
      issues.push({
        path: `${path}.target.layerId`,
        message: `Unknown layer: ${bindingTarget.layerId}`,
      });
    } else if (layer.type !== "component") {
      issues.push({
        path: `${path}.target.layerId`,
        message: `Layer "${bindingTarget.layerId}" is not a component layer (type "${layer.type}")`,
      });
    } else {
      const component = componentById.get(layer.payload.componentId);
      if (!component) {
        issues.push({
          path: `${path}.target.layerId`,
          message: `Component layer "${bindingTarget.layerId}" references unknown component "${layer.payload.componentId}"`,
        });
      } else {
        const prop = component.props.find((p) => p.id === bindingTarget.propId);
        if (!prop) {
          issues.push({
            path: `${path}.target.propId`,
            message: `Component "${layer.payload.componentId}" does not declare prop "${bindingTarget.propId}"`,
          });
        } else {
          const variable = projectVariableById.get(binding.source.variableId);
          if (variable) {
            issues.push(
              ...validateVariableAgainstProp(
                variable,
                prop,
                assetById,
                `${path}.target.propId`,
              ),
            );
          }
        }
      }
    }
  }

  issues.push(...detectComponentCycles(componentById));

  issues.push(...validateLayerGraphV1(project.layers, "layers"));
  issues.push(
    ...validateLayerAssetsV1(projectLayers, project.assets, "layers"),
  );
  issues.push(
    ...validateComponentLayerReferences(
      projectLayers,
      componentById,
      assetById,
      "layers",
    ),
  );

  for (const component of project.components) {
    const componentLayers = flattenLayerTree(component.layers);
    issues.push(
      ...validateLayerGraphV1(
        component.layers,
        `components.${component.id}.layers`,
      ),
    );
    issues.push(
      ...validateLayerAssetsV1(
        componentLayers,
        project.assets,
        `components.${component.id}.layers`,
      ),
    );
    issues.push(
      ...validateComponentLayerReferences(
        componentLayers,
        componentById,
        assetById,
        `components.${component.id}.layers`,
      ),
    );

    const propById = new Map(component.props.map((p) => [p.id, p] as const));
    const componentLayerIds = new Set(componentLayers.map((n) => n.id));

    const propIds = component.props.map((p) => p.id);
    for (const dupId of new Set(duplicates(propIds))) {
      issues.push({
        path: `components.${component.id}.props`,
        message: `Duplicate prop id: ${dupId}`,
      });
    }

    for (const prop of component.props) {
      issues.push(
        ...validatePropValue(
          prop.default,
          prop,
          assetById,
          `components.${component.id}.props.${prop.id}.default`,
        ),
      );
    }

    const layerPropertySeen = new Map<string, string>();
    const childPropSeen = new Map<string, string>();
    for (const binding of component.propBindings) {
      const prop = propById.get(binding.propId);
      if (!prop) {
        issues.push({
          path: `components.${component.id}.propBindings`,
          message: `propBinding references unknown prop "${binding.propId}"`,
        });
        continue;
      }
      const target = binding.target;
      if (target.kind === "layerProperty") {
        const layerPropertyKey = `${target.layerId}\0${target.property}`;
        if (layerPropertySeen.has(layerPropertyKey)) {
          issues.push({
            path: `components.${component.id}.propBindings`,
            message: `Duplicate layerProperty target "${target.layerId}" "${target.property}"`,
          });
        } else {
          layerPropertySeen.set(layerPropertyKey, binding.propId);
        }
        const layer = componentLayers.find(
          (item) => item.id === target.layerId,
        );
        if (!layer) {
          issues.push({
            path: `components.${component.id}.propBindings`,
            message: `propBinding for "${binding.propId}" references unknown layer "${target.layerId}"`,
          });
        } else if (!isPropBindingPropertyValid(layer, target.property)) {
          issues.push({
            path: `components.${component.id}.propBindings`,
            message: `propBinding for "${binding.propId}" targets unsupported property "${target.property}" on ${layer.type} layer "${layer.id}"`,
          });
        } else if (!isOwnerPropSink(prop.kind, target.property, layer.type)) {
          issues.push({
            path: `components.${component.id}.propBindings`,
            message: `propBinding for "${binding.propId}" targets "${target.property}" which is not a V1 ${prop.kind} sink`,
          });
        } else {
          const expected = motionPropertyCapability(
            layer.type,
            target.property,
          )?.valueKind;
          if (
            expected !== undefined &&
            !motionPropKindFitsValueKind(prop.kind, expected)
          ) {
            issues.push({
              path: `components.${component.id}.propBindings`,
              message: `propBinding kind mismatch: prop "${prop.id}" (${prop.kind}) → ${target.property} (${expected})`,
            });
          }
        }
      } else {
        const childPropKey = `${target.childLayerId}\0${target.propId}`;
        if (childPropSeen.has(childPropKey)) {
          issues.push({
            path: `components.${component.id}.propBindings`,
            message: `Duplicate childProp target "${target.childLayerId}" "${target.propId}"`,
          });
        } else {
          childPropSeen.set(childPropKey, binding.propId);
        }
        const childLayer = componentLayers.find(
          (item) => item.id === target.childLayerId,
        );
        if (!childLayer) {
          issues.push({
            path: `components.${component.id}.propBindings`,
            message: `propBinding for "${binding.propId}" references unknown child "${target.childLayerId}"`,
          });
        } else if (childLayer.type !== "component") {
          issues.push({
            path: `components.${component.id}.propBindings`,
            message: `propBinding childProp target "${target.childLayerId}" is not a component layer (type "${childLayer.type}")`,
          });
        } else {
          const childDef = componentById.get(childLayer.payload.componentId);
          if (!childDef) {
            issues.push({
              path: `components.${component.id}.propBindings`,
              message: `propBinding child component "${childLayer.payload.componentId}" is not defined in project`,
            });
          } else {
            const childProp = childDef.props.find(
              (p) => p.id === target.propId,
            );
            if (!childProp) {
              issues.push({
                path: `components.${component.id}.propBindings`,
                message: `propBinding forwards to unknown child prop "${target.propId}" on component "${childDef.id}"`,
              });
            } else if (!propKindsCompatible(prop.kind, childProp.kind)) {
              issues.push({
                path: `components.${component.id}.propBindings`,
                message: `propBinding kind mismatch: parent prop "${prop.id}" (${prop.kind}) → child prop "${childProp.id}" (${childProp.kind})`,
              });
            }
          }
        }
      }
    }

    for (const layer of componentLayers) {
      if (
        layer.parentLayerId !== null &&
        !componentLayerIds.has(layer.parentLayerId)
      ) {
        issues.push({
          path: `components.${component.id}.layers.${layer.id}.parentLayerId`,
          message: `Component layer "${layer.id}" references external parent "${layer.parentLayerId}" — component layers must not reference layers outside the component`,
        });
      }
    }
    const variantIds = component.variants.map((v) => v.id);
    for (const dupId of new Set(duplicates(variantIds))) {
      issues.push({
        path: `components.${component.id}.variants`,
        message: `Duplicate variant id: ${dupId}`,
      });
    }
    const propIdSet = new Set(component.props.map((p) => p.id));
    for (const variant of component.variants) {
      for (const propId of Object.keys(variant.props ?? {})) {
        if (!propIdSet.has(propId)) {
          issues.push({
            path: `components.${component.id}.variants.${variant.id}.props.${propId}`,
            message: `Variant "${variant.id}" sets unknown prop "${propId}"`,
          });
          continue;
        }
        const prop = propById.get(propId)!;
        const value = variant.props[propId];
        issues.push(
          ...validatePropValue(
            value,
            prop,
            assetById,
            `components.${component.id}.variants.${variant.id}.props.${propId}`,
          ),
        );
      }
    }
  }

  return issues;
}
