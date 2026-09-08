"use client";

import { useCallback, type MutableRefObject, type CompositionEvent as ReactCompositionEvent, type FormEvent as ReactFormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  deleteTextAtCaret,
  moveTextCaret,
  replaceTextAtSelection,
  type TextEditSession,
} from "@motionvideo/editor-core";

type Props = {
  sessionRef: MutableRefObject<TextEditSession | null>;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  composingRef: MutableRefObject<boolean>;
  updateTextEditDraft: (draftText: string, selection?: { start: number; end: number }) => void;
  commitTextEdit: () => void;
  cancelTextEdit: () => void;
  resetCaretBlink: () => void;
};

export function useTextEditKeyboard({
  sessionRef,
  textareaRef,
  composingRef,
  updateTextEditDraft,
  commitTextEdit,
  cancelTextEdit,
  resetCaretBlink,
}: Props) {
  const inputRef = textareaRef;
  const compositionStateRef = composingRef;
  const consumeInput = useCallback((value: string) => {
    const currentSession = sessionRef.current;
    if (!currentSession || value.length === 0) return;
    const next = replaceTextAtSelection(currentSession, value);
    updateTextEditDraft(next.draftText, next.selection);
    resetCaretBlink();
    if (inputRef.current) inputRef.current.value = "";
  }, [inputRef, resetCaretBlink, sessionRef, updateTextEditDraft]);

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const currentSession = sessionRef.current;
    if (!currentSession) return;
    const modifier = event.metaKey || event.ctrlKey;
    if (event.key === "Escape") { event.preventDefault(); cancelTextEdit(); return; }
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) {
        const next = replaceTextAtSelection(currentSession, "\n");
        updateTextEditDraft(next.draftText, next.selection);
        resetCaretBlink();
      } else commitTextEdit();
      return;
    }
    if (modifier && event.key.toLowerCase() === "a") {
      event.preventDefault();
      updateTextEditDraft(currentSession.draftText, { start: 0, end: currentSession.draftText.length });
      resetCaretBlink();
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      const next = deleteTextAtCaret(currentSession, event.key === "Backspace" ? "backward" : "forward");
      updateTextEditDraft(next.draftText, next.selection);
      resetCaretBlink();
      return;
    }
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const direction = event.key === "ArrowLeft"
        ? "left"
        : event.key === "ArrowRight"
          ? "right"
          : event.key.toLowerCase() as "home" | "end";
      const next = moveTextCaret(currentSession, direction, event.shiftKey);
      updateTextEditDraft(next.draftText, next.selection);
      resetCaretBlink();
    }
  }, [cancelTextEdit, commitTextEdit, resetCaretBlink, sessionRef, updateTextEditDraft]);

  const onInput = useCallback((event: ReactFormEvent<HTMLTextAreaElement>) => {
    if (!compositionStateRef.current) consumeInput(event.currentTarget.value);
  }, [compositionStateRef, consumeInput]);

  const onCompositionStart = useCallback(() => {
    compositionStateRef.current = true;
  }, [compositionStateRef]);

  const onCompositionEnd = useCallback((event: ReactCompositionEvent<HTMLTextAreaElement>) => {
    compositionStateRef.current = false;
    consumeInput(event.currentTarget.value);
  }, [compositionStateRef, consumeInput]);

  return { onKeyDown, onInput, onCompositionStart, onCompositionEnd };
}
