import type { z } from "zod";
import { motionPropertyCapability } from "../../capabilities";
import { CutoutVariantSlotSchema, type MotionComponentV2 } from "../component";
import { validateNodeAssets } from "./assets";
import { clipScheduleStarts, validateClips } from "./clips";
import { duplicates, valueAtPath } from "./helpers";
import { validateNodeGraph } from "./node-graph";
import { validatePropertyPath, validateVariableCapabilityValue } from "./property-path";
import type { ReferenceIssue } from "./types";

export function validateMotionComponentV2References(component: MotionComponentV2): ReferenceIssue[] {
  const issues = validateNodeGraph(component.nodes, "nodes");
  issues.push(...validateNodeAssets(component.nodes, component.assets, "nodes"));
  const variableIds = new Set(component.variables.map((variable) => variable.id));
  const nodeIds = new Set(component.nodes.map((node) => node.id));
  for (const id of new Set(duplicates(component.variables.map((variable) => variable.id)))) issues.push({ path: "variables", message: `Duplicate variable id: ${id}` });
  for (const id of new Set(duplicates(component.assets.map((asset) => asset.id)))) issues.push({ path: "assets", message: `Duplicate asset id: ${id}` });
  for (const id of new Set(duplicates(component.publicAPI.map((api) => api.id)))) issues.push({ path: "publicAPI", message: `Duplicate public API id: ${id}` });
  issues.push(...validateClips(component.clips, component.nodes, component.variables, "clips"));
  const assetById = new Map(component.assets.map((asset) => [asset.id, asset]));
  const nodeById = new Map(component.nodes.map((node) => [node.id, node]));
  for (const id of new Set(duplicates(component.sourceImports.map((sourceImport) => sourceImport.id)))) issues.push({ path: "sourceImports", message: `Duplicate source import id: ${id}` });
  for (const sourceImport of component.sourceImports) {
    const sourceAsset = assetById.get(sourceImport.sourceAssetId);
    if (!sourceAsset) issues.push({ path: `sourceImports.${sourceImport.id}.sourceAssetId`, message: `Unknown source SVG asset: ${sourceImport.sourceAssetId}` });
    else if (sourceAsset.assetType !== "svg") issues.push({ path: `sourceImports.${sourceImport.id}.sourceAssetId`, message: `Source import asset has type ${sourceAsset.assetType}, expected svg` });
    else if (sourceAsset.integrity !== sourceImport.sourceIntegrity) issues.push({ path: `sourceImports.${sourceImport.id}.sourceIntegrity`, message: "Source import integrity does not match source asset" });
    for (const id of new Set(duplicates(sourceImport.parts.map((part) => part.id)))) issues.push({ path: `sourceImports.${sourceImport.id}.parts`, message: `Duplicate source part id: ${id}` });
    const sourceOwners = new Map<string, string>();
    for (const part of sourceImport.parts) {
      for (const sourceElementId of part.sourceElementIds) {
        const owner = sourceOwners.get(sourceElementId);
        if (owner) issues.push({ path: `sourceImports.${sourceImport.id}.parts.${part.id}.sourceElementIds`, message: `Source element ${sourceElementId} is already assigned to part ${owner}` });
        else sourceOwners.set(sourceElementId, part.id);
      }
      const node = nodeById.get(part.nodeId);
      const outputAsset = assetById.get(part.outputAssetId);
      if (!node) issues.push({ path: `sourceImports.${sourceImport.id}.parts.${part.id}.nodeId`, message: `Unknown mapped node: ${part.nodeId}` });
      else if (node.type !== "svg") issues.push({ path: `sourceImports.${sourceImport.id}.parts.${part.id}.nodeId`, message: `Mapped part node has type ${node.type}, expected svg` });
      else if (node.payload.assetId !== part.outputAssetId) issues.push({ path: `sourceImports.${sourceImport.id}.parts.${part.id}.outputAssetId`, message: `Mapped output asset does not match node ${part.nodeId}` });
      if (!outputAsset) issues.push({ path: `sourceImports.${sourceImport.id}.parts.${part.id}.outputAssetId`, message: `Unknown output asset: ${part.outputAssetId}` });
      else if (outputAsset.assetType !== "svg") issues.push({ path: `sourceImports.${sourceImport.id}.parts.${part.id}.outputAssetId`, message: `Output part asset has type ${outputAsset.assetType}, expected svg` });
    }
  }
  for (const id of new Set(duplicates(component.cutoutRigs.map((rig) => rig.id)))) issues.push({ path: "cutoutRigs", message: `Duplicate cut-out rig id: ${id}` });
  const variantSlotByNode = new Map<string, z.infer<typeof CutoutVariantSlotSchema>>();
  const variantSlotById = new Map<string, z.infer<typeof CutoutVariantSlotSchema>>();
  for (const rig of component.cutoutRigs) {
    if (!nodeById.has(rig.rootNodeId)) issues.push({ path: `cutoutRigs.${rig.id}.rootNodeId`, message: `Unknown rig root: ${rig.rootNodeId}` });
    for (const id of new Set(duplicates(rig.slots.map((slot) => slot.id)))) issues.push({ path: `cutoutRigs.${rig.id}.slots`, message: `Duplicate variant slot id: ${id}` });
    for (const slot of rig.slots) {
      const node = nodeById.get(slot.nodeId);
      if (!node) issues.push({ path: `cutoutRigs.${rig.id}.slots.${slot.id}.nodeId`, message: `Unknown slot node: ${slot.nodeId}` });
      else if (node.type !== "svg") issues.push({ path: `cutoutRigs.${rig.id}.slots.${slot.id}.nodeId`, message: `Variant slot node has type ${node.type}, expected svg` });
      if (variantSlotByNode.has(slot.nodeId)) issues.push({ path: `cutoutRigs.${rig.id}.slots.${slot.id}.nodeId`, message: `Node already owns a variant slot: ${slot.nodeId}` });
      else variantSlotByNode.set(slot.nodeId, slot);
      if (!variantSlotById.has(slot.id)) variantSlotById.set(slot.id, slot);
      for (const id of new Set(duplicates(slot.variants.map((variant) => variant.id)))) issues.push({ path: `cutoutRigs.${rig.id}.slots.${slot.id}.variants`, message: `Duplicate variant id: ${id}` });
      const defaultVariant = slot.variants.find((variant) => variant.id === slot.defaultVariantId);
      if (!defaultVariant) issues.push({ path: `cutoutRigs.${rig.id}.slots.${slot.id}.defaultVariantId`, message: `Unknown default variant: ${slot.defaultVariantId}` });
      else if (node?.type === "svg" && node.payload.assetId !== defaultVariant.assetId) issues.push({ path: `cutoutRigs.${rig.id}.slots.${slot.id}.defaultVariantId`, message: "Slot node asset must match its default variant" });
      for (const variant of slot.variants) {
        const asset = assetById.get(variant.assetId);
        if (!asset) issues.push({ path: `cutoutRigs.${rig.id}.slots.${slot.id}.variants.${variant.id}.assetId`, message: `Unknown variant asset: ${variant.assetId}` });
        else if (asset.assetType !== "svg") issues.push({ path: `cutoutRigs.${rig.id}.slots.${slot.id}.variants.${variant.id}.assetId`, message: `Variant asset has type ${asset.assetType}, expected svg` });
      }
    }
  }
  for (const id of new Set(duplicates(component.actions.map((action) => action.id)))) issues.push({ path: "actions", message: `Duplicate action id: ${id}` });
  for (const action of component.actions) {
    issues.push(...validateClips(action.clips, component.nodes, component.variables, `actions.${action.id}.clips`, { variantSlots: variantSlotByNode }));
    if (action.lipSync) {
      const slot = variantSlotById.get(action.lipSync.slotId);
      const cuePath = `actions.${action.id}.lipSync`;
      if (!slot) issues.push({ path: `${cuePath}.slotId`, message: `Unknown lip-sync slot: ${action.lipSync.slotId}` });
      for (let index = 0; index < action.lipSync.cues.length; index += 1) {
        const cue = action.lipSync.cues[index]!;
        if (cue.at > action.duration) issues.push({ path: `${cuePath}.cues.${cue.id}`, message: `Lip-sync cue time ${cue.at} exceeds action duration ${action.duration}` });
        if (index > 0 && cue.at <= action.lipSync.cues[index - 1]!.at) {
          issues.push({ path: cuePath, message: "Lip-sync cue times must be strictly increasing" });
          break;
        }
        if (slot && !slot.variants.some((variant) => variant.id === cue.variantId)) {
          issues.push({ path: `${cuePath}.cues.${cue.id}.variantId`, message: `Unknown lip-sync variant ${cue.variantId} for slot ${slot.id}` });
        }
      }
    }
    const starts = clipScheduleStarts(action.clips);
    for (const clip of action.clips) {
      const start = starts.get(clip.id);
      if (start !== undefined && start + clip.duration > action.duration) issues.push({ path: `actions.${action.id}.clips.${clip.id}`, message: `Action clip exceeds action duration ${action.duration}` });
    }
  }
  for (const api of component.publicAPI) {
    if (!variableIds.has(api.variableId)) issues.push({ path: `publicAPI.${api.id}.variableId`, message: `Unknown variable: ${api.variableId}` });
    const variable = component.variables.find((candidate) => candidate.id === api.variableId);
    if (variable && variable.type !== api.type) issues.push({ path: `publicAPI.${api.id}.type`, message: `Expected variable type ${variable.type}, got ${api.type}` });
  }
  for (const binding of component.bindings) {
    if (binding.source.kind === "variable" && !variableIds.has(binding.source.variableId)) {
      issues.push({ path: `bindings.${binding.id}.source`, message: `Unknown variable: ${binding.source.variableId}` });
    }
    const target = component.nodes.find((node) => node.id === binding.target.nodeId);
    if (!target) issues.push({ path: `bindings.${binding.id}.target`, message: `Unknown node: ${binding.target.nodeId}` });
    else {
      const propertyPath = `bindings.${binding.id}.target.property`;
      issues.push(...validatePropertyPath(target, binding.target.property, "binding", propertyPath));
      if (binding.source.kind === "variable") {
        const variableId = binding.source.variableId;
        const variable = component.variables.find((candidate) => candidate.id === variableId);
        const capability = motionPropertyCapability(target.type, binding.target.property);
        if (variable && capability) {
          const message = validateVariableCapabilityValue(variable, capability, binding.target.property);
          if (message) issues.push({ path: propertyPath, message: message.replace("value for", "binding for") });
        }
      }
    }
  }
  const componentBindingTargets = new Map<string, string>();
  for (const binding of component.bindings) {
    const key = `${binding.target.nodeId}\u0000${binding.target.property}`;
    const previous = componentBindingTargets.get(key);
    if (previous) {
      issues.push({
        path: `bindings.${binding.id}.target`,
        message: `Duplicate binding target ${binding.target.nodeId}.${binding.target.property} (also bound by ${previous})`,
      });
    } else {
      componentBindingTargets.set(key, binding.id);
    }
  }
  for (const node of component.nodes) {
    if (node.repeat?.source.kind !== "list") continue;
    const source = node.repeat.source;
    const variable = component.variables.find((candidate) => candidate.id === source.variableId);
    if (!variable) {
      issues.push({ path: `nodes.${node.id}.repeat.source.variableId`, message: `Unknown variable: ${source.variableId}` });
      continue;
    }
    if (variable.type !== "list") {
      issues.push({ path: `nodes.${node.id}.repeat.source.variableId`, message: `Repeater source must be a list variable: ${source.variableId}` });
      continue;
    }
    const keys: string[] = [];
    variable.value.forEach((item, index) => {
      const key = valueAtPath(item, source.keyPath);
      if (typeof key !== "string" && typeof key !== "number") issues.push({ path: `nodes.${node.id}.repeat.source.keyPath`, message: `Repeater key ${source.keyPath} is missing at item ${index}` });
      else keys.push(String(key));
    });
    for (const key of new Set(duplicates(keys))) issues.push({ path: `nodes.${node.id}.repeat.source.keyPath`, message: `Duplicate Repeater key: ${key}` });
  }
  const referencedVariables = new Set<string>();
  const collectReferences = (value: unknown): void => {
    if (Array.isArray(value)) { for (const item of value) collectReferences(item); return; }
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (record.ref && typeof record.ref === "object" && (record.ref as Record<string, unknown>).kind === "variable") {
      const id = (record.ref as Record<string, unknown>).id;
      if (typeof id === "string") referencedVariables.add(id);
    }
    for (const nested of Object.values(record)) collectReferences(nested);
  };
  collectReferences(component.clips);
  collectReferences(component.actions);
  for (const variableId of referencedVariables) if (!variableIds.has(variableId)) issues.push({ path: "clips", message: `Unknown referenced variable: ${variableId}` });
  return issues;
}
