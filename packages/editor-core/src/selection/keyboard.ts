export type KeyboardSelectionModifiers = {
  shiftKey?: boolean;
  additiveKey?: boolean;
};

/** Apply the editor click/shift-range/toggle selection contract. */
export function updateKeyboardSelection(
  orderedIds: readonly string[],
  selectedIds: readonly string[],
  targetId: string,
  modifiers: KeyboardSelectionModifiers = {},
): string[] {
  const targetIndex = orderedIds.indexOf(targetId);
  const anchorId = selectedIds.at(-1);
  const anchorIndex = anchorId ? orderedIds.indexOf(anchorId) : -1;
  if (modifiers.shiftKey && targetIndex >= 0 && anchorIndex >= 0) {
    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);
    return orderedIds.slice(start, end + 1);
  }
  if (modifiers.additiveKey) {
    return selectedIds.includes(targetId)
      ? selectedIds.filter((id) => id !== targetId)
      : [...selectedIds, targetId];
  }
  return [targetId];
}
