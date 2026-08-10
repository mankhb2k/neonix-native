/**
 * V3 namespaced extensions.
 *
 * Extensions must use a dotted namespace (`com.moticlip.foo`) so different
 * tooling can coexist without key collisions. Values are intentionally
 * opaque (`unknown`) — they never enter the render hash.
 */
import { z } from "zod";

export const NAMESPACED_KEY_REGEX = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

export const NamespacedExtensionsSchema = z
  .record(z.string().regex(NAMESPACED_KEY_REGEX), z.unknown())
  .default({});

export type NamespacedExtensions = z.infer<typeof NamespacedExtensionsSchema>;
