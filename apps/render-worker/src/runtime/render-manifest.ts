import type { MotionRuntimeProject } from "@motionvideo/motion-protocol";
import {
  computeRuntimeHash,
  MOTION_RUNTIME_VERSION,
  CAPABILITY_MANIFEST_VERSION_V3,
} from "@motionvideo/motion-protocol";

/**
 * Phase 10-11: Render manifest with project hash, runtime hash, compiler version,
 * protocol version, capability fingerprint, capability manifest version, and asset hashes.
 *
 * Built from the compiled MotionRuntimeProject after compilation.
 */
export interface RenderManifestDigest {
  /** Format identifier. */
  format: "moticlip-render-manifest";
  /** Manifest protocol version (NOT a MotionProject formatVersion). */
  manifestVersion: 2;
  /** Project metadata id. */
  projectId: string;
  /** Versions of tools used. */
  versions: {
    /** Protocol/runtime schema version. */
    runtime: number;
    /** Compiler version that produced this IR. */
    compiler: string;
    /** Capability fingerprint from compile time. */
    capability: string;
    /** Capability manifest version used for fingerprinting. */
    capabilityManifest: string;
  };
  /** SHA-256 of the canonical compiled runtime JSON. */
  runtimeHash: string;
  /** Per-asset integrity hashes (SHA-256). */
  assetHashes: Array<{
    id: string;
    sha256: string;
    assetType: string;
  }>;
}

/**
 * Build a render manifest digest from the compiled MotionRuntimeProject.
 * Includes project hash (runtimeHash), compiler version, protocol version,
 * capability fingerprint, capability manifest version, and per-asset integrity hashes.
 */
export function buildRenderManifestDigest(
  compiled: MotionRuntimeProject,
): RenderManifestDigest {
  const runtimeHash =
    compiled.runtimeHash ??
    computeRuntimeHash(compiled as unknown as Record<string, unknown>);

  return {
    format: "moticlip-render-manifest",
    manifestVersion: 2,
    projectId: compiled.metadata.id,
    versions: {
      runtime: MOTION_RUNTIME_VERSION,
      compiler: compiled.compilerVersion ?? "unknown",
      capability: compiled.capabilityFingerprint ?? "unknown",
      capabilityManifest: CAPABILITY_MANIFEST_VERSION_V3,
    },
    runtimeHash,
    assetHashes: compiled.assets.map((asset) => ({
      id: asset.id,
      sha256: asset.integrity ?? "unsigned",
      assetType: asset.assetType,
    })),
  };
}
