/** Điểm 2D trong hệ tọa độ client. */
export type Point = {
  x: number;
  y: number;
};

/** @deprecated Dùng `Point` — giữ `PointerPos` để migrate dần. */
export type PointerPos = Point;
