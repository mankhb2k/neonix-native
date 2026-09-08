export type TextEditFramePreview = {
  layerId: string;
  height: number;
};

export type TextEditFramePreviewInput = {
  layerId: string;
  beforeText: string;
  draftText: string;
  lineHeight: number;
  wrapsText: boolean;
  measuredLineCount?: number;
};

/** Pure text-edit frame policy. Font measurement stays outside editor-core. */
export function buildTextEditFramePreview(
  input: TextEditFramePreviewInput,
): TextEditFramePreview | null {
  const beforeLineCount = Math.max(1, input.beforeText.split("\n").length);
  const draftLineCount = Math.max(1, input.draftText.split("\n").length);
  if (draftLineCount <= beforeLineCount) return null;
  const measuredLineCount = input.measuredLineCount ?? draftLineCount;
  const lineCount = input.wrapsText
    ? Math.max(draftLineCount, measuredLineCount)
    : draftLineCount;
  return {
    layerId: input.layerId,
    height: Math.max(1, input.lineHeight) * lineCount,
  };
}
