/** Trạng thái phím bổ trợ (Shift/Alt/Meta/Ctrl) trong một sự kiện con trỏ. */
export type PointerModifiers = {
  shift: boolean;
  alt: boolean;
  meta: boolean;
  ctrl: boolean;
};

export const EMPTY_POINTER_MODIFIERS: PointerModifiers = {
  shift: false,
  alt: false,
  meta: false,
  ctrl: false,
};
