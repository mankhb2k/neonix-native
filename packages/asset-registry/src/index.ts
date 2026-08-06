export type FontLicense = "OFL" | "Apache-2.0" | "proprietary";

export type FontEntry = {
  id: string;
  family: string;
  license: FontLicense;
  vietnameseSafe: boolean;
  roles: Array<"heading" | "body" | "display">;
  source: string;
};

/** Whitelist only — binary fonts live in /assets/fonts or CDN */
export const vietnameseSafeFonts: FontEntry[] = [
  {
    id: "be-vietnam-pro",
    family: "Be Vietnam Pro",
    license: "OFL",
    vietnameseSafe: true,
    roles: ["heading", "body"],
    source: "Google Fonts",
  },
  {
    id: "noto-sans",
    family: "Noto Sans",
    license: "OFL",
    vietnameseSafe: true,
    roles: ["body"],
    source: "Google Fonts",
  },
];

export function listSafeFonts(role?: FontEntry["roles"][number]): FontEntry[] {
  return vietnameseSafeFonts.filter(
    (f) => f.vietnameseSafe && (!role || f.roles.includes(role)),
  );
}

export {
  SvgImportError,
  assertSafeSvgExport,
  importSvgExport,
  reconcileSvgReimport,
  sanitizeSvgExport,
  type SvgImportElement,
  type SvgImportPart,
  type SvgImportResult,
  type SvgReimportConflict,
  type SvgReimportResult,
} from "./svg-import";

export {
  assertAssetHash,
  browserAssetRegistry,
  createAssetManifest,
  findAssetEntry,
  normalizeSha256,
  type AssetManifest,
  type AssetManifestEntry,
} from "./asset-manifest";

export {
  resolvedAssetFromManifestEntry,
  isFontMime,
  isVideoMime,
  isAudioMime,
  isImageMime,
  type ResolvedAsset,
} from "./resolved-asset";
