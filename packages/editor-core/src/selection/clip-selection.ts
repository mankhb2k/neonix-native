export type EditorSelection =
  | { kind: "none" }
  | { kind: "clips"; ids: string[]; primaryId: string }
  | { kind: "layer"; layerId: string };

const EMPTY_IDS: string[] = [];

export function selectionNone(): EditorSelection {
  return { kind: "none" };
}

export function selectionClips(
  ids: readonly string[],
  primaryId?: string,
): EditorSelection {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return selectionNone();
  return {
    kind: "clips",
    ids: unique,
    primaryId:
      primaryId && unique.includes(primaryId)
        ? primaryId
        : unique[unique.length - 1]!,
  };
}

export function selectedClipIds(selection: EditorSelection): string[] {
  return selection.kind === "clips" ? selection.ids : EMPTY_IDS;
}

/** Versionless alias used by timeline hosts when deriving selected clip ids. */
export const selectedClipIdsFrom = selectedClipIds;

