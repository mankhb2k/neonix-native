/** Evaluated 2D pose used by matrix/paint — not authoring MotionTransform. */
export type Transform2D = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  anchorX: number;
  anchorY: number;
  opacity: number;
  visible: boolean;
  flipX: boolean;
  flipY: boolean;
};

export type Matrix2D = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

export const IDENTITY_MATRIX: Matrix2D = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function multiplyMatrix(left: Matrix2D, right: Matrix2D): Matrix2D {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

export function translationMatrix(x: number, y: number): Matrix2D {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
}

export function rotationMatrix(degrees: number): Matrix2D {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return { a: cosine, b: sine, c: -sine, d: cosine, e: 0, f: 0 };
}

export function scaleMatrix(x: number, y: number): Matrix2D {
  return { a: x, b: 0, c: 0, d: y, e: 0, f: 0 };
}

export function skewMatrix(xDegrees: number, yDegrees: number): Matrix2D {
  const xRadians = (xDegrees * Math.PI) / 180;
  const yRadians = (yDegrees * Math.PI) / 180;
  return {
    a: 1,
    b: Math.tan(yRadians),
    c: Math.tan(xRadians),
    d: 1,
    e: 0,
    f: 0,
  };
}

export function localTransformMatrix(transform: Transform2D): Matrix2D {
  const flipX = transform.flipX ? -1 : 1;
  const flipY = transform.flipY ? -1 : 1;
  return multiplyMatrix(
    multiplyMatrix(
      multiplyMatrix(
        translationMatrix(transform.x, transform.y),
        rotationMatrix(transform.rotation),
      ),
      scaleMatrix(transform.scaleX * flipX, transform.scaleY * flipY),
    ),
    translationMatrix(-transform.anchorX * transform.width, -transform.anchorY * transform.height),
  );
}

export function applyMatrix(matrix: Matrix2D, x: number, y: number): { x: number; y: number } {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

type DecomposedMatrix = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
};

export function decomposeMatrix(matrix: Matrix2D): DecomposedMatrix {
  const scaleX = Math.hypot(matrix.a, matrix.b);
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  const scaleY = scaleX === 0 ? Math.hypot(matrix.c, matrix.d) : determinant / scaleX;
  return {
    x: matrix.e,
    y: matrix.f,
    rotation: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
    scaleX,
    scaleY,
  };
}

export function inheritedParentMatrix(
  parentWorld: Matrix2D,
  inherit: { position: boolean; rotation: boolean; scale: boolean },
): Matrix2D {
  if (inherit.position && inherit.rotation && inherit.scale) return parentWorld;
  const parent = decomposeMatrix(parentWorld);
  return multiplyMatrix(
    multiplyMatrix(
      translationMatrix(inherit.position ? parent.x : 0, inherit.position ? parent.y : 0),
      rotationMatrix(inherit.rotation ? parent.rotation : 0),
    ),
    scaleMatrix(inherit.scale ? parent.scaleX : 1, inherit.scale ? parent.scaleY : 1),
  );
}

export function matrixToCssTransform(matrix: Matrix2D): string {
  return `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.e}, ${matrix.f})`;
}
