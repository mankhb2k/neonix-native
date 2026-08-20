import {
  multiplyMatrix4,
  multiplyMatrix,
  IDENTITY_MATRIX4,
  matrix4ToArray,
  orthographicMatrix2D,
  perspectiveProjectionMatrix2D,
  rotationMatrixX,
  rotationMatrixY,
  rotationMatrixZ,
  rotationMatrix,
  scaleMatrix3D,
  scaleMatrix,
  skewMatrix3D,
  skewMatrix,
  translationMatrix3D,
  translationMatrix,
  type Matrix4,
  type Matrix2D,
  type PaintCommandBuffer,
} from "@motionvideo/motion-runtime";
import {
  MotionProtocolV2Schema,
  isV2AtomCertified,
  type MotionProtocolV2,
  type V2Transform,
} from "@motionvideo/motion-protocol/v2";

function shapeTransformMatrix2D(
  transform: V2Transform,
): Matrix2D {
  const anchorX = transform.anchor.x;
  const anchorY = transform.anchor.y;
  return multiplyMatrix(
    multiplyMatrix(
      multiplyMatrix(
        multiplyMatrix(
          translationMatrix(transform.translate.x, transform.translate.y),
          translationMatrix(anchorX, anchorY),
        ),
        rotationMatrix(transform.rotate.z),
      ),
      skewMatrix(transform.skew.x, transform.skew.y),
    ),
    multiplyMatrix(
      scaleMatrix(transform.scale.x, transform.scale.y),
      translationMatrix(-anchorX, -anchorY),
    ),
  );
}

function shapeModelMatrix4(
  transform: V2Transform,
): Matrix4 {
  const translate = translationMatrix3D(
    transform.translate.x,
    transform.translate.y,
    transform.translate.z,
  );
  const anchor = translationMatrix3D(
    transform.anchor.x,
    transform.anchor.y,
    transform.anchor.z,
  );
  const inverseAnchor = translationMatrix3D(
    -transform.anchor.x,
    -transform.anchor.y,
    -transform.anchor.z,
  );
  const rotation = multiplyMatrix4(
    multiplyMatrix4(
      rotationMatrixZ(transform.rotate.z),
      rotationMatrixY(transform.rotate.y),
    ),
    rotationMatrixX(transform.rotate.x),
  );
  let matrix = multiplyMatrix4(translate, anchor);
  matrix = multiplyMatrix4(matrix, rotation);
  matrix = multiplyMatrix4(
    matrix,
    skewMatrix3D(transform.skew.x, transform.skew.y),
  );
  matrix = multiplyMatrix4(
    matrix,
    scaleMatrix3D(
      transform.scale.x,
      transform.scale.y,
      transform.scale.z,
    ),
  );
  matrix = multiplyMatrix4(matrix, inverseAnchor);
  return matrix;
}

function viewProjectionMatrix4(project: MotionProtocolV2): {
  viewMatrix: Matrix4;
  projectionMatrix: Matrix4;
  viewProjectionMatrix: Matrix4;
} {
  const { width, height } = project.composition;
  const view = project.composition.view;
  let viewMatrix = IDENTITY_MATRIX4;
  if (view) {
    const viewTranslate = translationMatrix3D(
      -view.transform.translate.x,
      -view.transform.translate.y,
      -view.transform.translate.z,
    );
    const viewRotation = multiplyMatrix4(
      multiplyMatrix4(
        rotationMatrixX(-view.transform.rotate.x),
        rotationMatrixY(-view.transform.rotate.y),
      ),
      rotationMatrixZ(-view.transform.rotate.z),
    );
    viewMatrix = multiplyMatrix4(viewTranslate, viewRotation);
  }
  const projection = view?.projection;
  const projectionMatrix =
    projection?.kind === "perspective"
      ? perspectiveProjectionMatrix2D(
          width,
          height,
          projection.fov,
          projection.near,
          projection.far,
        )
      : orthographicMatrix2D(width, height);
  return {
    viewMatrix,
    projectionMatrix,
    viewProjectionMatrix: multiplyMatrix4(projectionMatrix, viewMatrix),
  };
}

function stableLayerOrder(
  project: MotionProtocolV2,
): MotionProtocolV2["layers"] {
  return [...project.layers].sort(
    (left, right) =>
      left.zIndex - right.zIndex || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  );
}

const DEFAULT_RECTANGLE_STROKE_WIDTH = 4;

/**
 * Protocol V2 shape compiler boundary.
 *
 * Atomic semantic transforms are lowered into both a legacy affine matrix and
 * a backend-neutral column-major Matrix4 during the Runtime IR migration.
 */
export function compileProtocolV2ToPaintCommands(
  input: unknown,
  options: { frame?: number; time?: number } = {},
): PaintCommandBuffer {
  const project = MotionProtocolV2Schema.parse(input);
  const frame = options.frame ?? 0;
  const time = options.time ?? frame / project.composition.fps;
  const projection = viewProjectionMatrix4(project);
  const commands: PaintCommandBuffer["commands"] = [
    {
      op: "beginFrame",
      width: project.composition.width,
      height: project.composition.height,
      background: project.composition.background,
      graphId: project.id,
      frame,
      time,
      projection: {
        viewMatrix: matrix4ToArray(projection.viewMatrix),
        projectionMatrix: matrix4ToArray(projection.projectionMatrix),
        viewProjectionMatrix: matrix4ToArray(projection.viewProjectionMatrix),
      },
    },
  ];

  for (const layer of stableLayerOrder(project)) {
    const fillCapability = `${layer.type}.${layer.payload.shape}.fill`;
    if (!isV2AtomCertified(fillCapability)) {
      throw new Error(`Uncertified Protocol V2 atom: ${fillCapability}`);
    }
    if (layer.style.stroke !== undefined) {
      const strokeCapability = `${layer.type}.${layer.payload.shape}.stroke`;
      if (!isV2AtomCertified(strokeCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${strokeCapability}`);
      }
    }
    if (layer.style.strokeWidth !== undefined) {
      if (layer.style.stroke === undefined) {
        throw new Error(`Protocol V2 atom ${layer.id}: strokeWidth requires stroke`);
      }
      const strokeWidthCapability = `${layer.type}.${layer.payload.shape}.strokeWidth`;
      if (!isV2AtomCertified(strokeWidthCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${strokeWidthCapability}`);
      }
    }
    if (layer.style.fillOpacity !== undefined) {
      const fillOpacityCapability = `${layer.type}.${layer.payload.shape}.fillOpacity`;
      if (!isV2AtomCertified(fillOpacityCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${fillOpacityCapability}`);
      }
    }
    if (layer.style.strokeOpacity !== undefined) {
      if (layer.style.stroke === undefined) {
        throw new Error(`Protocol V2 atom ${layer.id}: strokeOpacity requires stroke`);
      }
      const strokeOpacityCapability = `${layer.type}.${layer.payload.shape}.strokeOpacity`;
      if (!isV2AtomCertified(strokeOpacityCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${strokeOpacityCapability}`);
      }
    }
    if (layer.timing.start > time || time >= layer.timing.start + layer.timing.duration) {
      continue;
    }
    commands.push({
      op: "setTransform",
      key: layer.id,
      matrix: shapeTransformMatrix2D(layer.transform),
      matrix4: Array.from(shapeModelMatrix4(layer.transform)),
      alpha: layer.opacity / 100,
      visible: layer.opacity > 0,
      zIndex: layer.zIndex,
    });
    commands.push({
      op: "drawShape",
      key: layer.id,
      layerId: layer.id,
      shape: layer.payload.shape,
      fill: layer.style.fill,
      width: layer.frame.width,
      height: layer.frame.height,
      ...(layer.style.fillOpacity !== undefined
        ? { fillOpacity: layer.style.fillOpacity }
        : {}),
      ...(layer.style.stroke !== undefined
        ? {
            stroke: layer.style.stroke,
            strokeWidth: layer.style.strokeWidth ?? DEFAULT_RECTANGLE_STROKE_WIDTH,
            ...(layer.style.strokeOpacity !== undefined
              ? { strokeOpacity: layer.style.strokeOpacity }
              : {}),
          }
        : {}),
    });
  }

  commands.push({ op: "endFrame" });
  return { version: 1, commands, diagnostics: [] };
}
