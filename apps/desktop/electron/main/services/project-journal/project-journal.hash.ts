/** Shared document hash helper (kept free of journal service cycle). */
import { createHash } from "node:crypto";

export function hashDocumentJson(documentJson: string): string {
  return createHash("sha256").update(documentJson).digest("hex");
}
