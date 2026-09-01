import { describe, expect, it } from "vitest";
import {
  arrayToMatrix4,
  composeLocalMatrix4,
  createMatrix4,
  identityMatrix4,
  invertMatrix4,
  matrix4FromValues,
  multiplyMatrix4,
  orthographicProjectionMatrix,
  perspectiveProjectionMatrix,
  scaleMatrix3D,
  translationMatrix3D,
  transformPoint4,
  transformPoint3D,
  projectPoint3D,
} from "./matrix4";

const identityValues = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
] as const;

describe("Matrix4 factories", () => {
  it("creates a fresh identity matrix for every call", () => {
    const first = identityMatrix4();
    const second = identityMatrix4();
    first[12] = 42;

    expect(Array.from(second)).toEqual(identityValues);
    expect(first).not.toBe(second);
  });

  it("accepts exactly 16 finite values", () => {
    expect(Array.from(matrix4FromValues(identityValues))).toEqual(identityValues);
    expect(Array.from(createMatrix4(identityValues))).toEqual(identityValues);
    expect(Array.from(arrayToMatrix4(identityValues))).toEqual(identityValues);
  });

  it("rejects partial, oversized, and non-finite input", () => {
    expect(() => createMatrix4([1, 2])).toThrow(/exactly 16/);
    expect(() => createMatrix4([...identityValues, 0])).toThrow(/exactly 16/);
    expect(() => createMatrix4(identityValues.map((value, index) => index === 0 ? NaN : value))).toThrow(
      /finite/,
    );
    expect(() => arrayToMatrix4([1, 2])).toThrow(/exactly 16/);
  });
});

describe("Matrix4 inverse", () => {
  it("inverts small affine scales without an absolute determinant false positive", () => {
    const matrix = multiplyMatrix4(
      translationMatrix3D(240, -80, 12),
      scaleMatrix3D(1e-6, 2e-6, 3e-6),
    );
    const inverse = invertMatrix4(matrix);

    expect(inverse).toBeDefined();
    const product = multiplyMatrix4(matrix, inverse!);
    expect(product[0]).toBeCloseTo(1, 8);
    expect(product[5]).toBeCloseTo(1, 8);
    expect(product[10]).toBeCloseTo(1, 8);
    expect(product[15]).toBeCloseTo(1, 8);
    expect(product[12]).toBeCloseTo(0, 8);
    expect(product[13]).toBeCloseTo(0, 8);
    expect(product[14]).toBeCloseTo(0, 8);
  });

  it("returns undefined for a singular matrix", () => {
    expect(invertMatrix4(scaleMatrix3D(1, 0, 1))).toBeUndefined();
  });
});

describe("Canonical local Matrix4 composition", () => {
  const identityTransform = {
    translate: { x: 0, y: 0, z: 0 },
    rotate: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    skew: { x: 0, y: 0 },
    anchor: { x: 0, y: 0, z: 0 },
  };

  it("keeps identity and applies XYZ translation", () => {
    expect(Array.from(composeLocalMatrix4(identityTransform))).toEqual(identityValues);
    const point = transformPoint3D(
      composeLocalMatrix4({
        ...identityTransform,
        translate: { x: 12, y: -8, z: 40 },
      }),
      0,
      0,
      0,
    );
    expect(point).toEqual({ x: 12, y: -8, z: 40 });
  });

  it("supports independent rotation, scale, and skew components", () => {
    const matrix = composeLocalMatrix4({
      ...identityTransform,
      rotate: { x: 10, y: 20, z: 30 },
      scale: { x: 2, y: 3, z: 4 },
      skew: { x: 5, y: 7 },
    });
    expect(matrix).toHaveLength(16);
    expect(matrix.every(Number.isFinite)).toBe(true);
    expect(matrix[0]).not.toBeCloseTo(1, 8);
  });

  it("preserves a plane when only the anchor changes without rotation", () => {
    const matrix = composeLocalMatrix4({
      ...identityTransform,
      anchor: { x: 80, y: 40, z: 120 },
    });
    expect(transformPoint3D(matrix, 10, 20, 30)).toEqual({ x: 10, y: 20, z: 30 });
  });

  it("makes non-zero anchor Z affect X/Y rotation pivots", () => {
    const rotateX = composeLocalMatrix4({
      ...identityTransform,
      rotate: { x: 90, y: 0, z: 0 },
      anchor: { x: 0, y: 0, z: 100 },
    });
    const rotateY = composeLocalMatrix4({
      ...identityTransform,
      rotate: { x: 0, y: 90, z: 0 },
      anchor: { x: 0, y: 0, z: 100 },
    });
    expect(transformPoint3D(rotateX, 0, 0, 0)!.y).toBeCloseTo(100, 8);
    expect(transformPoint3D(rotateY, 0, 0, 0)!.x).toBeCloseTo(-100, 8);
  });

  it("uses ordered operations and distinguishes translate-rotate order", () => {
    const translateRotate = composeLocalMatrix4({
      ...identityTransform,
      operations: [
        { type: "translate", x: 10, y: 0 },
        { type: "rotate", angle: 90 },
      ],
    });
    const rotateTranslate = composeLocalMatrix4({
      ...identityTransform,
      operations: [
        { type: "rotate", angle: 90 },
        { type: "translate", x: 10, y: 0 },
      ],
    });
    const first = transformPoint3D(translateRotate, 0, 0, 0)!;
    const second = transformPoint3D(rotateTranslate, 0, 0, 0)!;
    expect(first.x).toBeCloseTo(10, 8);
    expect(first.y).toBeCloseTo(0, 8);
    expect(second.x).toBeCloseTo(0, 8);
    expect(second.y).toBeCloseTo(10, 8);
  });

  it("evaluates perspective and matrix operations", () => {
    const perspective = composeLocalMatrix4({
      ...identityTransform,
      operations: [{ type: "extension", name: "motion.perspective", value: 800 }],
    });
    expect(perspective[11]).toBeCloseTo(-1 / 800, 12);
    const matrix = composeLocalMatrix4({
      ...identityTransform,
      operations: [{ type: "extension", name: "motion.matrix4", value: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 24, 12, 0, 1] }],
    });
    expect(transformPoint3D(matrix, 0, 0, 0)).toMatchObject({ x: 24, y: 12 });
  });
});

describe("Matrix4 homogeneous projection safety", () => {
  it("uses centered zoom and canonical clip Z for orthographic projection", () => {
    const projection = orthographicProjectionMatrix(320, 180, 2, 1, 4000);

    expect(projectPoint3D(projection, { x: 160, y: 90, z: 0 })).toMatchObject({
      kind: "projected",
      x: 0,
      y: 0,
    });
    const nearPlane = projectPoint3D(projection, { x: 160, y: 90, z: 1 });
    const farPlane = projectPoint3D(projection, { x: 160, y: 90, z: -4000 });
    expect(nearPlane).toMatchObject({ kind: "projected" });
    expect(farPlane).toMatchObject({ kind: "projected" });
    if (nearPlane.kind === "projected") expect(nearPlane.z).toBeCloseTo(0, 12);
    if (farPlane.kind === "projected") expect(farPlane.z).toBeCloseTo(1, 12);
  });

  it("keeps w explicit before perspective division", () => {
    const matrix = translationMatrix3D(12, -8, 40);
    expect(transformPoint4(matrix, { x: 0, y: 0, z: 0 })).toEqual({
      x: 12,
      y: -8,
      z: 40,
      w: 1,
    });
  });

  it("classifies the camera plane instead of teleporting to the origin", () => {
    const cameraPlane = createMatrix4([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 0,
    ]);
    expect(projectPoint3D(cameraPlane, { x: 30, y: 40, z: 50 })).toEqual({
      kind: "clipped",
      reason: "near-plane",
      w: 0,
    });
    expect(transformPoint3D(cameraPlane, 30, 40, 50)).toBeUndefined();
  });

  it("distinguishes behind-camera, near-plane, far-plane, and valid points", () => {
    const behind = translationMatrix3D(0, 0, 0);
    behind[15] = -1;
    expect(projectPoint3D(behind, { x: 0, y: 0, z: 0 })).toMatchObject({
      kind: "clipped",
      reason: "behind-camera",
    });

    const near = identityMatrix4();
    near[14] = -1;
    expect(projectPoint3D(near, { x: 0, y: 0, z: 0 })).toMatchObject({
      kind: "clipped",
      reason: "near-plane",
    });

    const far = identityMatrix4();
    far[14] = 2;
    expect(projectPoint3D(far, { x: 0, y: 0, z: 0 })).toMatchObject({
      kind: "clipped",
      reason: "far-plane",
    });

    expect(projectPoint3D(identityMatrix4(), { x: 2, y: -3, z: 0.5 })).toEqual({
      kind: "projected",
      x: 2,
      y: -3,
      z: 0.5,
      w: 1,
    });
  });

  it("uses the canonical clip Z range for V2 perspective projection", () => {
    const height = 180;
    const near = 1;
    const far = 4000;
    const fov = 60;
    const cameraDistance = (height / 2) / Math.tan((fov * Math.PI) / 360);
    const projection = perspectiveProjectionMatrix(320, height, fov, near, far);
    const nearPlane = projectPoint3D(projection, {
      x: 0,
      y: 0,
      z: cameraDistance - near,
    });
    const farPlane = projectPoint3D(projection, {
      x: 0,
      y: 0,
      z: cameraDistance - far,
    });

    expect(projectPoint3D(projection, { x: 0, y: 0, z: 0 })).toMatchObject({
      kind: "projected",
    });
    expect(nearPlane).toMatchObject({ kind: "projected" });
    expect(farPlane).toMatchObject({ kind: "projected" });
    if (nearPlane.kind === "projected") expect(nearPlane.z).toBeCloseTo(0, 12);
    if (farPlane.kind === "projected") expect(farPlane.z).toBeCloseTo(1, 12);
    expect(
      projectPoint3D(projection, {
        x: 0,
        y: 0,
        z: cameraDistance - near + 0.01,
      }),
    ).toMatchObject({ kind: "clipped", reason: "near-plane" });
    expect(
      projectPoint3D(projection, {
        x: 0,
        y: 0,
        z: cameraDistance - far - 0.01,
      }),
    ).toMatchObject({ kind: "clipped", reason: "far-plane" });
  });

  it("classifies non-finite homogeneous coordinates explicitly", () => {
    const matrix = identityMatrix4();
    matrix[0] = Number.NaN;
    expect(projectPoint3D(matrix, { x: 1, y: 2, z: 0 })).toEqual({
      kind: "clipped",
      reason: "non-finite",
      w: 1,
    });
  });
});
