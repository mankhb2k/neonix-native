"use client";

import { boundsStyle, percent } from "../shared/stage-layout";
import type { TextEditToolController } from "./use-text-edit-tool";

type Props = {
  compositionWidth: number;
  compositionHeight: number;
  controller: TextEditToolController;
};

export type TextEditOverlayHandle = {
  refresh: () => void;
};

/** DOM-only surface for TextEditTool. It does not own editor state or commands. */
export function TextEditOverlay({ compositionWidth, compositionHeight, controller }: Props) {
  const {
    rootRef,
    canvasRef,
    textareaRef,
    bounds,
    isEditing,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onDoubleClick,
    onKeyDown,
    onInput,
    onCompositionStart,
    onCompositionEnd,
  } = controller;

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-[5]" data-testid={isEditing ? "stage-text-edit-overlay" : undefined} aria-hidden={!isEditing}>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
      {isEditing && bounds ? (
        <>
          <div
            data-text-edit-hitbox="true"
            data-testid="stage-text-edit-hitbox"
            className="pointer-events-auto absolute cursor-text"
            style={{
              ...boundsStyle(bounds, compositionWidth, compositionHeight),
              transform: bounds.rotation ? `rotate(${bounds.rotation}deg)` : undefined,
              transformOrigin: `${percent(bounds.transformOriginX ?? bounds.width / 2, bounds.width)} ${percent(bounds.transformOriginY ?? bounds.height / 2, bounds.height)}`,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onDoubleClick={onDoubleClick}
          />
          <textarea
            ref={textareaRef}
            data-testid="stage-text-edit-input"
            aria-label="Text editor input"
            className="fixed left-[-10000px] top-[-10000px] h-px w-px opacity-0"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onKeyDown={onKeyDown}
            onInput={onInput}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
          />
        </>
      ) : null}
    </div>
  );
}
