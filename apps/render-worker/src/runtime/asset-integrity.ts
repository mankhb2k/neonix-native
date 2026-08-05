/**
 * Validate project asset integrity hashes when declared (sha256-…).
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MotionProject } from "@motionvideo/motion-schema";

export type AssetIntegrityResult = {
  ok: boolean;
  checked: number;
  errors: string[];
};

function parseSha256Integrity(integrity: string | undefined): string | null {
  if (!integrity) return null;
  const match = /^sha256-([a-fA-F0-9]{64})$/.exec(integrity.trim());
  return match?.[1]?.toLowerCase() ?? null;
}

export async function validateProjectAssetIntegrity(
  project: MotionProject,
  assetBaseDir: string,
): Promise<AssetIntegrityResult> {
  const errors: string[] = [];
  let checked = 0;

  for (const asset of project.assets ?? []) {
    const expected = parseSha256Integrity(
      "integrity" in asset ? (asset.integrity as string | undefined) : undefined,
    );
    if (!expected) continue;
    if (!asset.uri || path.isAbsolute(asset.uri)) {
      errors.push(`Asset ${asset.id}: integrity set but URI missing/absolute`);
      continue;
    }
    const file = path.resolve(assetBaseDir, asset.uri);
    const relative = path.relative(assetBaseDir, file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      errors.push(`Asset ${asset.id}: URI escapes asset base`);
      continue;
    }
    try {
      const bytes = await readFile(file);
      const actual = createHash("sha256").update(bytes).digest("hex");
      checked += 1;
      if (actual !== expected) {
        errors.push(
          `Asset ${asset.id}: integrity mismatch (expected ${expected.slice(0, 8)}… got ${actual.slice(0, 8)}…)`,
        );
      }
    } catch (error) {
      errors.push(
        `Asset ${asset.id}: cannot read ${asset.uri} (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }

  return { ok: errors.length === 0, checked, errors };
}
