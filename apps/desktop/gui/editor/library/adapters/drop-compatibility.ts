/**
 * Library payload ↔ timeline lane compatibility for ghost/commit.
 */

import type { LibraryPayload } from "../model/library-payload";

export function payloadAcceptsTrack(
  payload: LibraryPayload,
  track: "main" | "overlay" | "audio",
): boolean {
  if (payload.kind === "audio") return track === "audio";
  return track === "main" || track === "overlay";
}
