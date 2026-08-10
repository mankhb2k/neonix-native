import { MOTION_V2_LIMITS } from "../../capabilities";
import type { MotionNode } from "../../runtime/nodes";
import { getTextPayloadPlain, segmentTextUnits } from "../../runtime/nodes/text";
import { contourHasLength, duplicates, morphTopologyMismatch } from "./helpers";
import type { ReferenceIssue } from "./types";

export function validateNodeGraph(nodes: Array<MotionNode>, prefix: string): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const ids = nodes.map((node) => node.id);
  for (const id of new Set(duplicates(ids))) issues.push({ path: prefix, message: `Duplicate node id: ${id}` });
  for (const node of nodes) {
    const effects = node.effects ?? [];
    for (const id of new Set(duplicates(effects.map((effect) => effect.id)))) {
      issues.push({ path: `${prefix}.${node.id}.effects`, message: `Duplicate effect id: ${id}` });
    }
    if (node.type === "path") {
      const morphTargets = node.payload.morphTargets ?? [];
      for (const id of new Set(duplicates(morphTargets.map((target) => target.id)))) {
        issues.push({ path: `${prefix}.${node.id}.payload.morphTargets`, message: `Duplicate Path Morph target id: ${id}` });
      }
      for (const modifier of node.modifiers ?? []) {
        if (modifier.type !== "path-morph") continue;
        const targetById = new Map(morphTargets.map((target) => [target.id, target]));
        const fromContours = modifier.from === "base" ? node.payload.contours : targetById.get(modifier.from)?.contours;
        const toContours = targetById.get(modifier.to)?.contours;
        if (modifier.from !== "base" && !fromContours) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.from`, message: `Unknown Path Morph target: ${modifier.from}` });
        if (!toContours) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.to`, message: `Unknown Path Morph target: ${modifier.to}` });
        if (modifier.from === modifier.to) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}`, message: "Path Morph from and to targets must differ" });
        if (fromContours && toContours) {
          const mismatch = morphTopologyMismatch(fromContours, toContours);
          if (mismatch) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}`, message: mismatch });
        }
      }
    } else if ((node.modifiers ?? []).some((modifier) => modifier.type === "path-morph")) {
      issues.push({ path: `${prefix}.${node.id}.modifiers`, message: "Path Morph modifier requires a path node" });
    }
    if (node.type === "bone" && node.payload.rotationLimits && node.payload.rotationLimits.min > node.payload.rotationLimits.max) {
      issues.push({ path: `${prefix}.${node.id}.payload.rotationLimits.max`, message: "Bone rotation limit max must be >= min" });
    }
    if (node.type !== "path") continue;
    for (const id of new Set(duplicates(node.payload.contours.map((contour) => contour.id)))) {
      issues.push({ path: `${prefix}.${node.id}.payload.contours`, message: `Duplicate Path contour id: ${id}` });
    }
  }
  for (const node of nodes) {
    if (node.type !== "text" || !node.textAnimator) continue;
    const units = segmentTextUnits(getTextPayloadPlain(node.payload), node.textAnimator.unit, node.textAnimator.locale);
    if (units.length === 0) issues.push({ path: `${prefix}.${node.id}.textAnimator`, message: "Text Animator requires at least one text unit" });
    if (units.length > MOTION_V2_LIMITS.textAnimatorUnits) issues.push({ path: `${prefix}.${node.id}.textAnimator`, message: `Text Animator exceeds unit limit ${MOTION_V2_LIMITS.textAnimatorUnits}` });
    const selectedCount = units.filter((_, index) => {
      const progress = units.length <= 1 ? 0 : index / (units.length - 1);
      return progress >= node.textAnimator!.selector.start && progress <= node.textAnimator!.selector.end;
    }).length;
    const endTime = node.textAnimator.startTime + Math.max(0, selectedCount - 1) * node.textAnimator.stagger + node.textAnimator.duration;
    if (endTime > MOTION_V2_LIMITS.mediaDurationSeconds) issues.push({ path: `${prefix}.${node.id}.textAnimator`, message: `Text Animator timing exceeds maximum ${MOTION_V2_LIMITS.mediaDurationSeconds}` });
    if (nodes.some((candidate) => candidate.parentId === node.id)) issues.push({ path: `${prefix}.${node.id}.textAnimator`, message: "Text Animator node cannot own child nodes" });
    if (nodes.some((candidate) => candidate.mask?.sourceNodeId === node.id)) issues.push({ path: `${prefix}.${node.id}.textAnimator`, message: "Text Animator node cannot be a mask source" });
  }
  const idSet = new Set(ids);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const parentById = new Map(nodes.map((node) => [node.id, node.parentId]));
  const secondaryChainOwners = new Map<string, string>();
  for (const node of nodes) {
    if (node.parentId !== null && !idSet.has(node.parentId)) {
      issues.push({ path: `${prefix}.${node.id}.parentId`, message: `Unknown parent: ${node.parentId}` });
    }
    if (node.mask && !idSet.has(node.mask.sourceNodeId)) {
      issues.push({ path: `${prefix}.${node.id}.mask.sourceNodeId`, message: `Unknown mask source: ${node.mask.sourceNodeId}` });
    }
    const modifiers = node.modifiers ?? [];
    for (const id of new Set(duplicates(modifiers.map((modifier) => modifier.id)))) issues.push({ path: `${prefix}.${node.id}.modifiers`, message: `Duplicate modifier id: ${id}` });
    if (modifiers.filter((modifier) => modifier.type === "motion-path").length > 1) issues.push({ path: `${prefix}.${node.id}.modifiers`, message: "Only one motion-path modifier is allowed per node" });
    if (modifiers.filter((modifier) => modifier.type === "trim-path").length > 1) issues.push({ path: `${prefix}.${node.id}.modifiers`, message: "Only one trim-path modifier is allowed per node" });
    if (modifiers.filter((modifier) => modifier.type === "path-bend").length > 1) issues.push({ path: `${prefix}.${node.id}.modifiers`, message: "Only one path-bend modifier is allowed per node" });
    for (const modifier of modifiers) {
      if (modifier.type === "trim-path") {
        if (node.type !== "path") issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}`, message: "Trim Path modifier requires a path node" });
        if (modifier.start > modifier.end) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}`, message: "Trim Path end must be >= start" });
        continue;
      }
      if (modifier.type === "path-bend") {
        if (node.type !== "path") issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}`, message: "Path Bend modifier requires a path node" });
        continue;
      }
      if (modifier.type === "constraint") {
        const target = nodeById.get(modifier.targetNodeId);
        if (!target) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.targetNodeId`, message: `Unknown constraint target: ${modifier.targetNodeId}` });
        else if (modifier.targetNodeId === node.id) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.targetNodeId`, message: "Constraint cannot target itself" });
        continue;
      }
      if (modifier.type === "secondary-motion") {
        if (modifier.axis !== "rotation") issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.axis`, message: "Secondary Motion supports rotation axis only" });
        const driver = nodeById.get(modifier.driverNodeId);
        if (!driver) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.driverNodeId`, message: `Unknown Secondary Motion driver: ${modifier.driverNodeId}` });
        else if (driver.type !== "bone") issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.driverNodeId`, message: `Secondary Motion driver must be bone: ${modifier.driverNodeId}` });
        if (modifier.driverNodeId !== node.id) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.driverNodeId`, message: "Secondary Motion modifier must live on its driver node" });
        for (const chainNodeId of modifier.chainNodeIds) {
          const chainNode = nodeById.get(chainNodeId);
          if (!chainNode) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.chainNodeIds`, message: `Unknown Secondary Motion chain node: ${chainNodeId}` });
          else if (chainNode.type !== "bone") issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.chainNodeIds`, message: `Secondary Motion chain node must be bone: ${chainNodeId}` });
          const owner = secondaryChainOwners.get(chainNodeId);
          if (owner) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.chainNodeIds`, message: `Secondary Motion chain node already owned: ${chainNodeId}` });
          else secondaryChainOwners.set(chainNodeId, modifier.id);
        }
        for (const chainNodeId of new Set(duplicates(modifier.chainNodeIds))) {
          issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.chainNodeIds`, message: `Duplicate Secondary Motion chain node: ${chainNodeId}` });
        }
        continue;
      }
      if (modifier.type !== "motion-path") continue;
      if (modifier.startOffset > modifier.endOffset) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}`, message: "Motion Path endOffset must be >= startOffset" });
      const source = nodeById.get(modifier.pathNodeId);
      if (!source) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.pathNodeId`, message: `Unknown Motion Path node: ${modifier.pathNodeId}` });
      else if (source.type !== "path") issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.pathNodeId`, message: `Motion Path source ${modifier.pathNodeId} has type ${source.type}, expected path` });
      else {
        const contour = source.payload.contours.find((candidate) => candidate.id === modifier.contourId);
        if (!contour) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.contourId`, message: `Unknown Path contour: ${modifier.contourId}` });
        else if (!contourHasLength(contour)) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.contourId`, message: `Motion Path contour has zero length: ${modifier.contourId}` });
      }
      let ancestor = source?.parentId ?? null;
      while (ancestor && nodeById.has(ancestor)) {
        if (ancestor === node.id) {
          issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.pathNodeId`, message: "Motion Path source cannot be a descendant of its target" });
          break;
        }
        ancestor = nodeById.get(ancestor)?.parentId ?? null;
      }
    }
    const seen = new Set<string>([node.id]);
    let parent = node.parentId;
    let depth = 0;
    while (parent !== null && idSet.has(parent)) {
      if (seen.has(parent)) {
        issues.push({ path: `${prefix}.${node.id}.parentId`, message: "Parent cycle detected" });
        break;
      }
      seen.add(parent);
      parent = parentById.get(parent) ?? null;
      depth += 1;
      if (depth > MOTION_V2_LIMITS.hierarchyDepth) {
        issues.push({ path: `${prefix}.${node.id}.parentId`, message: `Hierarchy exceeds depth limit ${MOTION_V2_LIMITS.hierarchyDepth}` });
        break;
      }
    }
  }
  for (const node of nodes) {
    if (!node.mask) continue;
    const seen = new Set([node.id]);
    let current: MotionNode | undefined = node;
    while (current?.mask) {
      const sourceId = current.mask.sourceNodeId;
      if (seen.has(sourceId)) {
        issues.push({ path: `${prefix}.${node.id}.mask`, message: "Mask dependency cycle detected" });
        break;
      }
      seen.add(sourceId);
      current = nodeById.get(sourceId);
    }
  }
  for (const node of nodes) {
    const seen = new Set([node.id]);
    let current: MotionNode | undefined = node;
    const originModifier = node.modifiers?.find((modifier) => modifier.type === "motion-path");
    while (current) {
      const motionPath = current.modifiers?.find((modifier) => modifier.type === "motion-path");
      if (!motionPath) break;
      if (seen.has(motionPath.pathNodeId)) {
        issues.push({ path: `${prefix}.${node.id}.modifiers.${originModifier?.id ?? motionPath.id}`, message: "Motion Path dependency cycle detected" });
        break;
      }
      seen.add(motionPath.pathNodeId);
      current = nodeById.get(motionPath.pathNodeId);
    }
  }
  for (const node of nodes) {
    const origin = node.modifiers?.find((modifier) => modifier.type === "constraint");
    if (!origin) continue;
    const seen = new Set([node.id]);
    let current: MotionNode | undefined = node;
    while (current) {
      const constraint = current.modifiers?.find((modifier) => modifier.type === "constraint");
      if (!constraint) break;
      if (seen.has(constraint.targetNodeId)) {
        issues.push({ path: `${prefix}.${node.id}.modifiers.${origin.id}`, message: "Constraint dependency cycle detected" });
        break;
      }
      seen.add(constraint.targetNodeId);
      current = nodeById.get(constraint.targetNodeId);
    }
  }
  return issues;
}
