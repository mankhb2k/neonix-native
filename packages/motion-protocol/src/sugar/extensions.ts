/**
 * Extension theo namespace chấm (com.moticlip.foo).
 *
 * Giá trị opaque (unknown) — không vào render hash.
 */
import { z } from "zod";

export const NAMESPACED_KEY_REGEX = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

export const NamespacedExtensionsSchema = z
  .record(z.string().regex(NAMESPACED_KEY_REGEX), z.unknown())
  .default({});

export type NamespacedExtensions = z.infer<typeof NamespacedExtensionsSchema>;
