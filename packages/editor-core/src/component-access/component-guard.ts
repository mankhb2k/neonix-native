/**
 * Component Access Guard — enforces the component ownership contract at the
 * editor level.
 *
 * The contract:
 * - **Owner mode**: can edit ALL component internals (layers, bindings, actions,
 *   public surface). Used when the user is authoring/editing a component
 *   definition.
 * - **Consumer mode**: can ONLY interact with the public surface (props,
 *   variants, actions). Internal layers are sealed.
 *
 * These guards are designed to be called by the property panel, node tree,
 * and command executors BEFORE any mutation. They return structured results
 * so the UI can show clear error messages instead of silently failing.
 */

import type { V1 } from "@motionvideo/motion-protocol";

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
      /** Not editing a component at all — full access to scene layers. */
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
export const CONSUMER_READABLE_PROPERTIES = ["props", "variants"] as const;

export type ConsumerReadableProperty =
  (typeof CONSUMER_READABLE_PROPERTIES)[number];

/** Properties on the public surface that a consumer is allowed to write. */
export const CONSUMER_WRITABLE_PROPERTIES = ["props", "variants"] as const;

export type ConsumerWritableProperty =
  (typeof CONSUMER_WRITABLE_PROPERTIES)[number];

// ── Guard functions ────────────────────────────────────────────────────

/**
 * Check whether a consumer can read a specific component property.
 * Consumers can read all public surface properties.
 */
export function canConsumerRead(property: string): AccessCheckResult {
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
 * Consumers can only write to publicParams and variants.
 * Actions are read-only triggers, publicTargets are owner-only definitions.
 */
export function canConsumerWrite(property: string): AccessCheckResult {
  if ((CONSUMER_WRITABLE_PROPERTIES as readonly string[]).includes(property)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `"${property}" is read-only for consumers`,
    suggestion: `Use one of: ${CONSUMER_WRITABLE_PROPERTIES.join(", ")}`,
  };
}

/** Layer ids exposed to consumers via the component's public prop bindings. */
function exposedLayerIds(component: V1.ComponentDefinitionV1): Set<string> {
  const ids = new Set<string>();
  for (const binding of component.propBindings) {
    if (binding.target.kind === "layerProperty") {
      ids.add(binding.target.layerId);
    }
  }
  return ids;
}

/**
 * Check whether a node operation is allowed in the current editing context.
 *
 * In consumer mode, internal layers (layers, bindings, variables) are sealed.
 * In owner mode, all layers are editable.
 * In scene mode, all scene layers are editable.
 */
export function canAccessNode(
  context: ComponentEditContext,
  layerId: string,
  component?: V1.ComponentDefinitionV1,
): AccessCheckResult {
  if (context.mode === "scene") return { allowed: true };
  if (context.mode === "owner") return { allowed: true };

  // Consumer mode — only allow access if the node is referenced by a publicTarget
  if (component) {
    if (exposedLayerIds(component).has(layerId)) {
      return { allowed: true };
    }
  }

  return {
    allowed: false,
    reason: `Node "${layerId}" is internal to component "${context.componentId}" and not exposed via publicTargets`,
    suggestion: "Ask the component owner to expose this node as a publicTarget",
  };
}

/**
 * Check whether a binding operation is allowed in the current editing context.
 * Consumers cannot create or modify bindings that target component internals.
 */
export function canAccessBinding(
  context: ComponentEditContext,
  targetLayerId: string,
  component?: V1.ComponentDefinitionV1,
): AccessCheckResult {
  if (context.mode === "scene") return { allowed: true };
  if (context.mode === "owner") return { allowed: true };

  // Consumer mode — binding must go through a publicTarget
  if (component) {
    if (exposedLayerIds(component).has(targetLayerId)) {
      return { allowed: true };
    }
  }

  return {
    allowed: false,
    reason: `Cannot bind to internal node "${targetLayerId}" of component "${context.componentId}"`,
    suggestion:
      "Use a publicTarget to expose this property, or bind through an existing publicTarget",
  };
}

/**
 * Check whether a variant selection is valid for a component.
 * Only variants declared by the owner are allowed.
 */
export function canSelectVariant(
  component: V1.ComponentDefinitionV1,
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
