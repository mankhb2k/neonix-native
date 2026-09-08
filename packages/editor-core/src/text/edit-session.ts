import type { V2TextLayer } from "@motionvideo/motion-protocol/v2";

export type TextSelection = {
  start: number;
  end: number;
};

export type TextEditSnapshot = {
  text: string;
  frame: {
    width: number;
    height: number;
  };
};

export type TextEditSession = {
  layerId: string;
  before: TextEditSnapshot;
  draftText: string;
  selection: TextSelection;
};

function clampIndex(value: number, length: number): number {
  return Math.max(0, Math.min(length, Math.trunc(value)));
}

export function clampTextSelection(
  selection: TextSelection,
  textLength: number,
): TextSelection {
  const start = clampIndex(selection.start, textLength);
  const end = clampIndex(selection.end, textLength);
  return start <= end ? { start, end } : { start: end, end: start };
}

export function createTextEditSession(layer: V2TextLayer): TextEditSession {
  const text = layer.payload.source.text;
  return {
    layerId: layer.id,
    before: {
      text,
      frame: { width: layer.frame.width, height: layer.frame.height },
    },
    draftText: text,
    selection: { start: text.length, end: text.length },
  };
}

export function updateTextEditDraft(
  session: TextEditSession,
  draftText: string,
  selection: TextSelection = { start: draftText.length, end: draftText.length },
): TextEditSession {
  return {
    ...session,
    draftText,
    selection: clampTextSelection(selection, draftText.length),
  };
}

export function replaceTextAtSelection(
  session: TextEditSession,
  insertion: string,
): TextEditSession {
  const selection = clampTextSelection(session.selection, session.draftText.length);
  const draftText = `${session.draftText.slice(0, selection.start)}${insertion}${session.draftText.slice(selection.end)}`;
  const caret = selection.start + insertion.length;
  return updateTextEditDraft(session, draftText, { start: caret, end: caret });
}

/**
 * Delete the current selection or the character next to the caret.
 * Keeping this policy in core makes browser keyboard adapters stateless.
 */
export function deleteTextAtCaret(
  session: TextEditSession,
  direction: "backward" | "forward",
): TextEditSession {
  const selection = clampTextSelection(session.selection, session.draftText.length);
  if (selection.start !== selection.end) {
    return replaceTextAtSelection(session, "");
  }
  const start = direction === "backward"
    ? Math.max(0, selection.start - 1)
    : selection.start;
  const end = direction === "forward"
    ? Math.min(session.draftText.length, selection.end + 1)
    : selection.end;
  return updateTextEditDraft(
    session,
    session.draftText.slice(0, start) + session.draftText.slice(end),
    { start, end: start },
  );
}

export function moveTextCaret(
  session: TextEditSession,
  direction: "left" | "right" | "home" | "end",
  extend = false,
): TextEditSession {
  const current = clampTextSelection(session.selection, session.draftText.length);
  const anchor = extend ? session.selection.start : undefined;
  const currentCaret = session.selection.end;
  const next = direction === "home"
    ? 0
    : direction === "end"
      ? session.draftText.length
      : Math.max(0, Math.min(session.draftText.length, currentCaret + (direction === "left" ? -1 : 1)));
  return updateTextEditDraft(
    session,
    session.draftText,
    extend
      ? { start: anchor ?? current.start, end: next }
      : { start: next, end: next },
  );
}

export function textEditChanged(session: TextEditSession): boolean {
  return session.draftText !== session.before.text;
}

/**
 * Apply a draft to a V2 text layer without mutating the canonical document.
 * Same-length edits preserve all authored span ranges. When the length
 * changes, the first authored chunk/span becomes the safe fallback style so
 * every character remains covered by a valid V2 range.
 */
export function applyTextDraftToLayer(
  layer: V2TextLayer,
  draftText: string,
): V2TextLayer {
  const text = draftText.normalize("NFC");
  const previousText = layer.payload.source.text;
  const preserveLineBreaks = text.includes("\n");
  const draftLayout = preserveLineBreaks && layer.payload.layout
    ? { ...layer.payload.layout, whiteSpace: "pre-wrap" as const }
    : layer.payload.layout;
  const draftPayload = {
    ...layer.payload,
    source: {
      ...layer.payload.source,
      text,
      ...(preserveLineBreaks ? { whiteSpace: "preserve" as const } : {}),
    },
    ...(draftLayout ? { layout: draftLayout } : {}),
  };
  if (text.length === previousText.length) {
    return {
      ...layer,
      payload: draftPayload,
    };
  }

  const firstChunk = layer.payload.chunks[0]!;
  const firstSpan = firstChunk.spans[0]!;
  const fullRange = { start: 0, end: text.length };
  return {
    ...layer,
    payload: {
      ...draftPayload,
      chunks: [{
        ...firstChunk,
        sourceRange: fullRange,
        spans: [{ ...firstSpan, sourceRange: fullRange }],
      }],
    },
  };
}
