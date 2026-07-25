import { createHash } from "node:crypto";

export type SvgImportElement = {
  id: string;
  tag: string;
  originalName?: string;
  fingerprint: string;
  markup: string;
};

export type SvgImportPart = {
  id: string;
  sourceElementIds: string[];
  structuralFingerprint: string;
  originalName?: string;
  markup: string;
};

export type SvgImportResult = {
  viewBox: string;
  width?: number;
  height?: number;
  sanitizedSvg: string;
  elements: SvgImportElement[];
  parts: SvgImportPart[];
  sourceIntegrity: string;
};

export type SvgReimportConflict = {
  path: string;
  message: string;
  previousPartId?: string;
  nextPartId?: string;
};

export type SvgReimportResult = {
  kept: Array<{ previousPartId: string; nextPartId: string; nodeId?: string }>;
  conflicts: SvgReimportConflict[];
};

export class SvgImportError extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(message);
    this.name = "SvgImportError";
    this.path = path;
  }
}

function sha256(value: string): string {
  return `sha256-${createHash("sha256").update(value).digest("hex")}`;
}

function attr(openTag: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(openTag);
  return match?.[2] ?? match?.[3];
}

/** Reject unsafe SVG exports before any parse/map work. */
export function assertSafeSvgExport(svg: string): void {
  if (!svg.trim()) throw new SvgImportError("svg", "SVG is empty");
  if (/<script[\s>]/i.test(svg)) throw new SvgImportError("svg.script", "SVG script elements are not allowed");
  if (/\son[a-z]+\s*=/i.test(svg)) throw new SvgImportError("svg.event", "SVG event handler attributes are not allowed");
  if (/<(?:use|image|a)\b[^>]*(?:xlink:)?href\s*=\s*["']\s*https?:/i.test(svg)
    || /<(?:use|image|a)\b[^>]*(?:xlink:)?href\s*=\s*["']\s*\/\//i.test(svg)) {
    throw new SvgImportError("svg.externalUrl", "SVG external URL references are not allowed");
  }
  if (/<foreignObject[\s>]/i.test(svg)) throw new SvgImportError("svg.foreignObject", "SVG foreignObject is not allowed");
  if (!/<svg[\s>]/i.test(svg)) throw new SvgImportError("svg.root", "Malformed SVG: missing root <svg>");
  if (!/<\/svg\s*>/i.test(svg)) throw new SvgImportError("svg.root", "Malformed SVG: missing closing </svg>");
}

export function sanitizeSvgExport(svg: string): string {
  assertSafeSvgExport(svg);
  return svg.replace(/<!--[\s\S]*?-->/g, "").trim();
}

/** Leaf drawables only — avoids nested <g> markup explosion on dense Figma exports. */
function extractLeafElements(svg: string): Array<{ tag: string; open: string; markup: string }> {
  const elements: Array<{ tag: string; open: string; markup: string }> = [];
  const re = /<(path|rect|circle|ellipse|polygon|polyline)\b([^<>]*?)(\/>|>)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(svg))) {
    const tag = match[1]!.toLowerCase();
    const open = `<${tag}${match[2] ?? ""}`;
    if (match[3] === "/>") {
      elements.push({ tag, open, markup: `${open}/>` });
      continue;
    }
    const close = new RegExp(`</${tag}\\s*>`, "i");
    close.lastIndex = re.lastIndex;
    const end = close.exec(svg);
    if (!end) {
      // Treat unclosed leaf as malformed open tag body until next tag boundary.
      const next = svg.slice(re.lastIndex).search(/</);
      const endIndex = next === -1 ? svg.length : re.lastIndex + next;
      elements.push({ tag, open, markup: svg.slice(match.index, endIndex) });
      re.lastIndex = endIndex;
      continue;
    }
    elements.push({ tag, open, markup: svg.slice(match.index, end.index + end[0].length) });
    re.lastIndex = end.index + end[0].length;
  }
  return elements;
}

/**
 * Import a Figma/Illustrator-exported SVG into stable part/fingerprint metadata.
 * Each leaf drawable becomes a part; named groups are recorded via originalName when present on the leaf.
 */
export function importSvgExport(svg: string, options: { sourceId?: string; maxParts?: number } = {}): SvgImportResult {
  const sanitizedSvg = sanitizeSvgExport(svg);
  const sourceIntegrity = sha256(sanitizedSvg);
  const root = /<svg\b([^>]*)>/i.exec(sanitizedSvg)?.[1] ?? "";
  const rootOpen = `<svg ${root}>`;
  const viewBox = attr(rootOpen, "viewBox") ?? "0 0 100 100";
  const width = Number(attr(rootOpen, "width"));
  const height = Number(attr(rootOpen, "height"));
  const raw = extractLeafElements(sanitizedSvg);
  if (raw.length === 0) throw new SvgImportError("svg.parts", "SVG export has no drawable leaf elements");

  const elements: SvgImportElement[] = raw.map((entry, index) => {
    const named = attr(entry.open, "id") ?? attr(entry.open, "data-name");
    const id = (named?.trim() || `elem-${index}`).replace(/\s+/g, "-");
    const fingerprint = sha256(`${entry.tag}|${entry.markup}`);
    return {
      id,
      tag: entry.tag,
      ...(named ? { originalName: named } : {}),
      fingerprint,
      markup: entry.markup,
    };
  });

  const parts: SvgImportPart[] = elements.map((element) => ({
    id: `part.${element.id}`,
    sourceElementIds: [element.id],
    structuralFingerprint: element.fingerprint,
    ...(element.originalName ? { originalName: element.originalName } : {}),
    markup: element.markup,
  }));

  const maxParts = options.maxParts ?? 2_000;
  if (parts.length > maxParts) {
    throw new SvgImportError("svg.parts", `SVG import produced ${parts.length} parts; limit is ${maxParts}`);
  }

  return {
    viewBox,
    ...(Number.isFinite(width) ? { width } : {}),
    ...(Number.isFinite(height) ? { height } : {}),
    sanitizedSvg,
    elements,
    parts,
    sourceIntegrity,
  };
}

/** Reconcile a prior part mapping with a fresh import by structural fingerprint. */
export function reconcileSvgReimport(
  previous: Array<{ id: string; structuralFingerprint: string; nodeId?: string }>,
  next: SvgImportPart[],
): SvgReimportResult {
  const kept: SvgReimportResult["kept"] = [];
  const conflicts: SvgReimportConflict[] = [];
  const nextByFingerprint = new Map(next.map((part) => [part.structuralFingerprint, part]));
  const matchedNext = new Set<string>();

  for (const prior of previous) {
    const match = nextByFingerprint.get(prior.structuralFingerprint);
    if (match) {
      kept.push({ previousPartId: prior.id, nextPartId: match.id, ...(prior.nodeId ? { nodeId: prior.nodeId } : {}) });
      matchedNext.add(match.id);
      continue;
    }
    conflicts.push({
      path: `parts.${prior.id}`,
      message: "Source part fingerprint missing after re-import",
      previousPartId: prior.id,
    });
  }

  for (const part of next) {
    if (matchedNext.has(part.id)) continue;
    conflicts.push({
      path: `parts.${part.id}`,
      message: "New source part introduced on re-import",
      nextPartId: part.id,
    });
  }

  return { kept, conflicts };
}
