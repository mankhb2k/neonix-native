/**
 * Component Access Guard — enforces the component ownership contract at the
 * editor level.
 *
 * The contract:
 * - **Owner mode**: can edit ALL component internals (nodes, bindings, actions,
 *   public surface). Used when the user is authoring/editing a component
 *   definition.
 * - **Consumer mode**: can ONLY interact with the public surface (publicParams,
 *   slots, variants, publicTargets, actions). Internal nodes are sealed.
 *
 * These guards are designed to be called by the property panel, node tree,
 * and command executors BEFORE any mutation. They return structured results
 * so the UI can show clear error messages instead of silently failing.
 */

import type { V3 } from "@motionvideo/motion-protocol";

// ── Types ──────────────────────────────────────────────────────────────

/** Editing context: who is editing what. */
export type ComponentEditContext =
  | {
      mode: "owner";
      /** The component definition being edited directly. */
      componentId: string;
    }
  | {
      mode: "consumer";
      /**
       * The component definition (read-only reference). Consumer cannot
       * mutate this — only interact through the public surface.
       */
      componentId: string;
      /** The clip on the timeline that instantiates this component. */
      clipId: string;
    }
  | {
      /** Not editing a component at all — full access to scene nodes. */
      mode: "scene";
    };

export type AccessCheckResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: string;
      /** Suggested alternative the consumer CAN use. */
      suggestion?: string;
    };

// ── Public surface helpers ─────────────────────────────────────────────

/** Properties on the public surface that a consumer is allowed to read. */
export const CONSUMER_READABLE_PROPERTIES = [
  "publicParams",
  "slots",
  "variants",
  "actions",
  "publicTargets",
] as const;

export type ConsumerReadableProperty =
  (typeof CONSUMER_READABLE_PROPERTIES)[number];

/** Properties on the public surface that a consumer is allowed to write. */
export const CONSUMER_WRITABLE_PROPERTIES = [
  "publicParams",
  "slots",
  "variants",
] as const;

export type ConsumerWritableProperty =
  (typeof CONSUMER_WRITABLE_PROPERTIES)[number];

// ── Guard functions ────────────────────────────────────────────────────

/**
 * Check whether a consumer can read a specific component property.
 * Consumers can read all public surface properties.
 */
export function canConsumerRead(
  property: string,
): AccessCheckResult {
  if ((CONSUMER_READABLE_PROPERTIES as readonly string[]).includes(property)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `"${property}" is not part of the component's public surface`,
    suggestion: `Use one of: ${CONSUMER_READABLE_PROPERTIES.join(", ")}`,
  };
}

/**
 * Check whether a consumer can write to a specific component property.
 * Consumers can only write to publicParams, slots, and variants.
 * Actions are read-only triggers, publicTargets are owner-only definitions.
 */
export function canConsumerWrite(
  property: string,
): AccessCheckResult {
  if ((CONSUMER_WRITABLE_PROPERTIES as readonly string[]).includes(property)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `"${property}" is read-only for consumers`,
    suggestion:
      property === "actions"
        ? "Actions can be triggered but not modified by consumers"
        : property === "publicTargets"
          ? "publicTargets are defined by the component owner"
          : `Use one of: ${CONSUMER_WRITABLE_PROPERTIES.join(", ")}`,
  };
}

/**
 * Check whether a node operation is allowed in the current editing context.
 *
 * In consumer mode, internal nodes (nodes, bindings, variables) are sealed.
 * In owner mode, all nodes are editable.
 * In scene mode, all scene nodes are editable.
 */
export function canAccessNode(
  context: ComponentEditContext,
  nodeId: string,
  component?: V3.EmbeddedComponentV3,
): AccessCheckResult {
  if (context.mode === "scene") return { allowed: true };
  if (context.mode === "owner") return { allowed: true };

  // Consumer mode — only allow access if the node is referenced by a publicTarget
  if (component) {
    const isExposed = component.publicTargets.some(
      (pt) => pt.nodeId === nodeId,
    );
    if (isExposed) {
      return { allowed: true };
    }
  }

  return {
    allowed: false,
    reason: `Node "${nodeId}" is internal to component "${context.componentId}" and not exposed via publicTargets`,
    suggestion: "Ask the component owner to expose this node as a publicTarget",
  };
}

/**
 * Check whether a binding operation is allowed in the current editing context.
 * Consumers cannot create or modify bindings that target component internals.
 */
export function canAccessBinding(
  context: ComponentEditContext,
  targetNodeId: string,
  component?: V3.EmbeddedComponentV3,
): AccessCheckResult {
  if (context.mode === "scene") return { allowed: true };
  if (context.mode === "owner") return { allowed: true };

  // Consumer mode — binding must go through a publicTarget
  if (component) {
    const isExposed = component.publicTargets.some(
      (pt) => pt.nodeId === targetNodeId,
    );
    if (isExposed) {
      return { allowed: true };
    }
  }

  return {
    allowed: false,
    reason: `Cannot bind to internal node "${targetNodeId}" of component "${context.componentId}"`,
    suggestion:
      "Use a publicTarget to expose this property, or bind through an existing publicTarget",
  };
}

/**
 * Check whether a variant selection is valid for a component.
 * Only variants declared by the owner are allowed.
 */
export function canSelectVariant(
  component: V3.EmbeddedComponentV3,
  variantId: string,
): AccessCheckResult {
  const variant = component.variants.find((v) => v.id === variantId);
  if (variant) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `Variant "${variantId}" is not defined in component "${component.id}"`,
    suggestion: `Available variants: ${component.variants.map((v) => v.id).join(", ") || "none"}`,
  };
}

/**
 * Check whether a slot fill is valid for a component.
 * Only slots declared by the owner can be filled, and content must match
 * the accepted kinds.
 */
export function canFillSlot(
  component: V3.EmbeddedComponentV3,
  slotId: string,
  contentKind: string,
): AccessCheckResult {
  const slot = component.slots.find((s) => s.id === slotId);
  if (!slot) {
    return {
      allowed: false,
      reason: `Slot "${slotId}" is not defined in component "${component.id}"`,
      suggestion: `Available slots: ${component.slots.map((s) => s.id).join(", ") || "none"}`,
    };
  }
  if (!slot.accepts.includes(contentKind as V3.SlotContentKind)) {
    return {
      allowed: false,
      reason: `Slot "${slotId}" does not accept "${contentKind}"`,
      suggestion: `Accepted kinds: ${slot.accepts.join(", ")}`,
    };
  }
  return { allowed: true };
}

/**
 * Determine the editing context based on what is currently selected.
 * Returns `null` if no component context applies.
 */
export function resolveComponentEditContext(
  selectedComponentId: string | null,
  selectedClipId: string | null,
  isOwnerMode: boolean,
): ComponentEditContext {
  if (!selectedComponentId) return { mode: "scene" };
  if (isOwnerMode) {
    return { mode: "owner", componentId: selectedComponentId };
  }
  return {
    mode: "consumer",
    componentId: selectedComponentId,
    clipId: selectedClipId ?? "unknown",
  };
}
