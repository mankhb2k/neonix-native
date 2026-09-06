import { create } from "fontkit";

export const USER_FONT_FORMATS = ["ttf", "woff", "woff2"] as const;
export type UserFontFormat = (typeof USER_FONT_FORMATS)[number];
export type FontStyle = "normal" | "italic" | "oblique";

export type ParsedFontMetadata = {
  familyName: string;
  subfamilyName: string;
  postscriptName: string | null;
  version: string;
  weight: number;
  style: FontStyle;
  widthClass: "normal";
  axes: Record<string, unknown>;
  faceKey: string;
};

const WEIGHTS: Array<[RegExp, number]> = [
  [/thin|hairline/i, 100],
  [/extra\s*light|ultra\s*light/i, 200],
  [/light/i, 300],
  [/regular|normal|book|roman/i, 400],
  [/medium/i, 500],
  [/semi\s*bold|demi\s*bold/i, 600],
  [/bold/i, 700],
  [/extra\s*bold|ultra\s*bold/i, 800],
  [/black|heavy/i, 900],
];

function normalized(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ");
}

function inferStyle(subfamilyName: string): FontStyle {
  if (/oblique/i.test(subfamilyName)) return "oblique";
  if (/italic/i.test(subfamilyName)) return "italic";
  return "normal";
}

function inferWeight(subfamilyName: string, os2Weight: unknown): number {
  const named = WEIGHTS.find(([pattern]) => pattern.test(subfamilyName));
  if (named) return named[1];
  const value = Number(os2Weight);
  return Number.isInteger(value) && value >= 1 && value <= 1000 ? value : 400;
}

export function formatFromFilename(name: string): UserFontFormat | null {
  const extension = name.toLowerCase().split(".").pop();
  return USER_FONT_FORMATS.includes(extension as UserFontFormat)
    ? extension as UserFontFormat
    : null;
}

export function mimeTypeForFontFormat(format: UserFontFormat): string {
  return `font/${format}`;
}

export function parseUserFont(buffer: Buffer): ParsedFontMetadata {
  let font: ReturnType<typeof create>;
  try {
    font = create(buffer);
  } catch {
    throw new Error("The file is not a valid static font");
  }

  const familyName = normalized(typeof font.familyName === "string" ? font.familyName : "");
  const subfamilyName = normalized(typeof font.subfamilyName === "string" ? font.subfamilyName : "Regular") || "Regular";
  if (!familyName) throw new Error("Font family metadata is missing");

  const axes = font.variationAxes && typeof font.variationAxes === "object" ? font.variationAxes : {};
  if (font.isVariable || Object.keys(axes).length > 0 || /\[[^\]]+\]/.test(familyName) || /\[[^\]]+\]/.test(subfamilyName)) {
    throw new Error("Variable fonts are not supported. Upload a static .ttf, .woff, or .woff2 face");
  }

  const style = inferStyle(subfamilyName);
  const os2 = font["OS/2"];
  const weight = inferWeight(subfamilyName, os2 && typeof os2 === "object" ? (os2 as { usWeightClass?: unknown }).usWeightClass : undefined);
  return {
    familyName,
    subfamilyName,
    postscriptName: typeof font.postscriptName === "string" ? font.postscriptName : null,
    version: typeof font.version === "string" ? font.version : "default",
    weight,
    style,
    widthClass: "normal",
    axes: {},
    faceKey: `${familyName.toLocaleLowerCase()}|${weight}|${style}`,
  };
}
