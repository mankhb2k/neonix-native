/**
 * V1 project-wide reference validation.
 */
import type { MotionProjectV1 } from "../project";
import type { LayerV1 } from "../layers";
import { flattenLayerTree } from "../layers";
import { isVariableReference } from "../values";
import type { ProjectVariableV1 } from "../variables";
import {
  defaultAnimatableForPropKind,
  defaultInterpolationForPropKind,
  type ComponentPropV1,
} from "../components";
import { isPropKeyframesValue } from "../prop-values";
import { duplicates } from "./helpers";
import { validateLayerGraphV1 } from "./layer-graph";
import { validateLayerAssetsV1 } from "./layer-assets";
import type { ReferenceIssue } from "./types";

const TRANSFORM_PUBLIC_PROPERTIES = new Set([
  "transform.x",
  "transform.y",
  "transform.z",
  "transform.depth",
  "transform.width",
  "transform.height",
  "transform.rotation",
  "transform.rotationX",
  "transform.rotationY",
  "transform.rotationZ",
  "transform.scaleX",
  "transform.scaleY",
  "transform.anchorX",
  "transform.anchorY",
  "transform.anchorZ",
  "transform.opacity",
  "transform.visible",
  "transform.flipX",
  "transform.flipY",
]);

const BASE_PUBLIC_PROPERTIES = new Set(["visible", "locked", "name", "zIndex"]);

const PAINT_STYLE_PUBLIC_PROPERTIES = new Set([
  "style.fill",
  "style.fillOpacity",
  "style.stroke",
  "style.strokeWidth",
  "style.strokeOpacity",
  "style.lineCap",
  "style.lineJoin",
  "style.miterLimit",
  "style.dash",
  "style.dashOffset",
]);

const LAYER_PUBLIC_PAYLOAD_PROPERTIES: Record<LayerV1["type"], Set<string>> = {
  group: new Set(["payload.compositing.mode"]),
  bone: new Set([
    "payload.length",
    "payload.restRotation",
    "payload.rotationLimits.min",
    "payload.rotationLimits.max",
  ]),
  text: new Set([
    "payload.content",
    "payload.content.text",
    "payload.fontAssetId",
    "payload.fontSize",
    "payload.color",
    "payload.alignment",
    "payload.wrap",
    "payload.lineHeight",
    "payload.letterSpacing",
    "payload.maxLines",
    "payload.overflow",
  ]),
  shape: new Set(["payload.shape", "payload.cornerRadius", "payload.points"]),
  path: new Set(["payload.contours", "payload.morphTargets"]),
  image: new Set([
    "payload.assetId",
    "payload.fit",
    "payload.crop",
    "payload.crop.x",
    "payload.crop.y",
    "payload.crop.width",
    "payload.crop.height",
  ]),
  svg: new Set([
    "payload.assetId",
    "payload.fit",
    "payload.crop",
    "payload.crop.x",
    "payload.crop.y",
    "payload.crop.width",
    "payload.crop.height",
  ]),
  video: new Set([
    "payload.assetId",
    "payload.fit",
    "payload.crop",
    "payload.crop.x",
    "payload.crop.y",
    "payload.crop.width",
    "payload.crop.height",
    "payload.trimStart",
    "payload.trimEnd",
    "payload.loop",
    "payload.muted",
    "payload.framePolicy",
  ]),
  camera: new Set([
    "payload.projection",
    "payload.zoom",
    "payload.parallaxStrength",
    "payload.focalLength",
    "payload.fieldOfView",
    "payload.near",
    "payload.far",
  ]),
  solid: new Set(["payload.width", "payload.height", "payload.color"]),
  adjustment: new Set([
    "payload.brightness",
    "payload.contrast",
    "payload.saturation",
  ]),
  component: new Set([]),
  audio: new Set([
    "payload.assetId",
    "payload.trimStart",
    "payload.trimEnd",
    "payload.playbackRate",
    "payload.volume",
    "payload.loop",
    "payload.fadeIn",
    "payload.fadeOut",
    "payload.muted",
  ]),
};

/** Path `property` có nằm trong API public của layer này không (transform / visible / payload theo type). */
function isPropBindingPropertyValid(layer: LayerV1, property: string): boolean {
  if (BASE_PUBLIC_PROPERTIES.has(property)) return true;
  if (TRANSFORM_PUBLIC_PROPERTIES.has(property)) return true;
  if (
    (layer.type === "shape" || layer.type === "path") &&
    PAINT_STYLE_PUBLIC_PROPERTIES.has(property)
  ) {
    return true;
  }
  return LAYER_PUBLIC_PAYLOAD_PROPERTIES[layer.type].has(property);
}

/**
 * Đoán kiểu giá trị của path trên layer (`transform.x` → number).
 * Không chắc thì trả undefined — không reject theo kind.
 */
function inferPropBindingValueKind(property: string): string | undefined {
  const segments = property.toLowerCase().split(".");
  const last = segments[segments.length - 1];
  if (!last) return undefined;

  if (last === "visible" || last === "flipx" || last === "flipy") {
    return "boolean";
  }
  if (
    last === "enabled" ||
    last === "muted" ||
    last === "loop" ||
    last === "locked"
  ) {
    return "boolean";
  }
  if (
    last.includes("color") ||
    last === "fill" ||
    last === "stroke" ||
    last === "tint" ||
    last === "background"
  ) {
    return "color";
  }
  if (last === "text" || last === "label" || last === "name") {
    return "string";
  }
  if (last === "assetid" || last === "fontassetid") {
    return "asset";
  }
  if (
    /^(?:opacity|width|height|scalex|scaley|rotation|x|y|z|depth|fontsize|letterspacing|lineheight|rate|volume|duration|start|end|progress|radius|length|fov|zoom|near|far|anchorx|anchory|anchorz|rotationx|rotationy|rotationz|trimstart|trimend|cornerradius|strokewidth|fillopacity|strokeopacity|maxlines)$/.test(
      last,
    )
  ) {
    return "number";
  }
  return undefined;
}

/** prop.kind (text/choice/…) có khớp kiểu path đã suy ra (string/number/…) không. */
function propKindFitsPathKind(propKind: string, pathKind: string): boolean {
  switch (propKind) {
    case "text":
    case "choice":
      return pathKind === "string";
    case "number":
      return pathKind === "number";
    case "boolean":
      return pathKind === "boolean";
    case "color":
      return pathKind === "color";
    case "asset":
      return pathKind === "asset";
    default:
      return true;
  }
}

function isPropAnimatable(prop: ComponentPropV1): boolean {
  return prop.animatable ?? defaultAnimatableForPropKind(prop.kind);
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
    case "text":
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

function variableTypeMatchesPropKind(
  variableType: string,
  propKind: string,
): boolean {
  switch (propKind) {
    case "text":
      return variableType === "string" || variableType === "enum";
    case "choice":
      return variableType === "enum" || variableType === "string";
    case "color":
      return variableType === "color";
    case "number":
      return variableType === "number";
    case "boolean":
      return variableType === "boolean";
    case "asset":
      return variableType === "asset";
    default:
      return true;
  }
}

function propKindsCompatible(parentKind: string, childKind: string): boolean {
  if (parentKind === childKind) return true;
  if (parentKind === "choice" && childKind === "text") return true;
  if (parentKind === "text" && childKind === "choice") return true;
  return false;
}

function allowedKeyframeInterpolations(propKind: string): Set<string> {
  if (propKind === "number") return new Set(["linear", "step"]);
  if (propKind === "color") return new Set(["color", "step"]);
  return new Set(["step"]);
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
    if (variable.type === "enum") {
      const extra = variable.options.filter(
        (option) => !prop.options!.includes(option),
      );
      if (extra.length > 0) {
        issues.push({
          path,
          message: `props "${prop.id}" enum variable "${variable.id}" has options not in prop options: ${extra.join(", ")}`,
        });
      }
      if (!prop.options.includes(variable.value)) {
        issues.push({
          path,
          message: `props "${prop.id}" enum variable "${variable.id}" value "${variable.value}" is not in options`,
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
  variableById: Map<string, ProjectVariableV1>,
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
          variableById,
          assetById,
          `${path}.keys.${i}.value`,
        ),
      );
    }
    return issues;
  }

  if (isVariableReference(value)) {
    const refId = extractVariableReferenceId(value);
    if (!refId) return issues;
    const variable = variableById.get(refId);
    if (!variable) {
      issues.push({
        path,
        message: `props "${prop.id}" references unknown variable "${refId}"`,
      });
      return issues;
    }
    issues.push(
      ...validateVariableAgainstProp(variable, prop, assetById, path),
    );
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

/** Extract the variable id from a top-level `{ ref: { kind: "variable", id } }` shape. */
function extractVariableReferenceId(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const ref = (value as Record<string, unknown>).ref;
  if (ref === null || typeof ref !== "object" || Array.isArray(ref)) {
    return undefined;
  }
  const record = ref as Record<string, unknown>;
  if (record.kind === "variable" && typeof record.id === "string") {
    return record.id;
  }
  return undefined;
}

/**
 * Kiểm tra instance `type: "component"` trên một cây layer.
 *
 * `variableById` do caller chọn phạm vi:
 * - cây `project.layers` → chỉ `project.variables` (consumer)
 * - cây `component.layers` → chỉ `component.variables` của owner đó
 *
 * `payload.props` phải khớp prop đã khai báo. Keyframe `t` là local theo
 * `layer.timing.duration` của instance.
 */
function validateComponentLayerReferences(
  layers: LayerV1[],
  componentById: Map<string, import("../components").ComponentDefinitionV1>,
  variableById: Map<string, ProjectVariableV1>,
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
          variableById,
          assetById,
          `${path}.payload.props.${propId}`,
          layer.timing?.duration,
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

  for (const binding of project.bindings) {
    const path = `bindings.${binding.id}`;
    const bindingTarget = binding.target;
    if (!variableIds.has(binding.source.variableId)) {
      issues.push({
        path: `${path}.source.variableId`,
        message: `Unknown variable: ${binding.source.variableId}`,
      });
    }
    if (bindingTarget.type === "layer") {
      // Binding thẳng vào layer trên cây project — không phải instance component.
      const layer = layerById.get(bindingTarget.layerId);
      if (!layer) {
        issues.push({
          path: `${path}.target.layerId`,
          message: `Unknown layer: ${bindingTarget.layerId}`,
        });
      } else if (!isPropBindingPropertyValid(layer, bindingTarget.property)) {
        // Chặn path giả (vd. payload.notAField) kẻo compiler tự tạo object dọc path.
        issues.push({
          path: `${path}.target.property`,
          message: `Binding targets unsupported property "${bindingTarget.property}" on ${layer.type} layer "${layer.id}"`,
        });
      }
    } else {
      // target.type === "componentLayer": chỉ được bind qua propId public.
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
        } else if (
          !component.props.some((p) => p.id === bindingTarget.propId)
        ) {
          issues.push({
            path: `${path}.target.propId`,
            message: `Component "${layer.payload.componentId}" does not declare prop "${bindingTarget.propId}"`,
          });
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
      projectVariableById,
      assetById,
      "layers",
    ),
  );

  for (const component of project.components) {
    // Biến nội bộ owner — không gộp vào project.variables.
    const ownerVariableById = new Map<string, ProjectVariableV1>();
    for (const dupId of new Set(
      duplicates(component.variables.map((variable) => variable.id)),
    )) {
      issues.push({
        path: `components.${component.id}.variables`,
        message: `Duplicate variable id: ${dupId}`,
      });
    }
    for (const variable of component.variables) {
      if (variableIds.has(variable.id)) {
        issues.push({
          path: `components.${component.id}.variables.${variable.id}`,
          message: `Component variable "${variable.id}" collides with project.variables — owner internals must stay scoped`,
        });
        continue;
      }
      if (!ownerVariableById.has(variable.id)) {
        ownerVariableById.set(variable.id, variable);
      }
    }

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
        ownerVariableById,
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
          ownerVariableById,
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
        const layer = componentLayers.find((item) => item.id === target.layerId);
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
        } else {
          const expected = inferPropBindingValueKind(target.property);
          if (
            expected !== undefined &&
            !propKindFitsPathKind(prop.kind, expected)
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
            const childProp = childDef.props.find((p) => p.id === target.propId);
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
            ownerVariableById,
            assetById,
            `components.${component.id}.variants.${variant.id}.props.${propId}`,
          ),
        );
      }
    }
  }

  return issues;
}
