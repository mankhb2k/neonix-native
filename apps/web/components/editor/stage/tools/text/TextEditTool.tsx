"use client";

import { useEffect, type MutableRefObject } from "react";
import { TextEditOverlay, type TextEditOverlayHandle } from "./TextEditOverlay";
import { useTextEditTool, type TextEditToolProps } from "./use-text-edit-tool";

type Props = TextEditToolProps & {
  overlayRef: MutableRefObject<TextEditOverlayHandle | null>;
};

/** Controller boundary for caret, selection, keyboard editing and glyph hit-testing. */
export function TextEditTool({ overlayRef, ...props }: Props) {
  const controller = useTextEditTool(props);
  const targetRef = overlayRef;
  useEffect(() => {
    targetRef.current = controller;
    return () => {
      if (targetRef.current === controller) targetRef.current = null;
    };
  }, [controller, targetRef]);
  return (
    <TextEditOverlay
      compositionWidth={props.compositionWidth}
      compositionHeight={props.compositionHeight}
      controller={controller}
    />
  );
}
