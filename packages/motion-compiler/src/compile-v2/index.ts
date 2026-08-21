import {
  multiplyMatrix4,
  multiplyMatrix,
  IDENTITY_MATRIX4,
  evaluateRuntimeProjectV2,
  frameIndexAtTime,
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
  type RuntimeProjectV2,
} from "@motionvideo/motion-runtime";
import {
  isV2AtomCertified,
  parseMotionProtocol,
  type MotionProtocolV2,
  type V2Transform,
} from "@motionvideo/motion-protocol";

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

export type CompileProtocolV2Options = Record<string, never>;

/** Compile Atomic Protocol V2 into backend-neutral Runtime IR V2. */
export function compileProtocolV2(
  input: unknown,
  _options: CompileProtocolV2Options = {},
): RuntimeProjectV2 {
  const project = parseMotionProtocol(input);
  const projection = viewProjectionMatrix4(project);

  const nodes = stableLayerOrder(project).map((layer) => {
    const fillCapability = `${layer.type}.${layer.payload.shape}.fill`;
    if (!isV2AtomCertified(fillCapability)) {
      throw new Error(`Uncertified Protocol V2 atom: ${fillCapability}`);
    }
    const gradientFill = typeof layer.style.fill === "object" ? layer.style.fill : null;
    if (gradientFill && !isV2AtomCertified(`${layer.type}.${layer.payload.shape}.gradient`)) {
      throw new Error(`Uncertified Protocol V2 atom: ${layer.type}.${layer.payload.shape}.gradient`);
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
    if (layer.payload.cornerRadius !== undefined) {
      if (layer.payload.shape !== "rectangle") {
        throw new Error(`Protocol V2 atom ${layer.id}: cornerRadius requires rectangle`);
      }
      const cornerRadiusCapability = `${layer.type}.${layer.payload.shape}.cornerRadius`;
      if (!isV2AtomCertified(cornerRadiusCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${cornerRadiusCapability}`);
      }
    }

    const localMatrix = shapeModelMatrix4(layer.transform);
    return {
      id: layer.id,
      parentId: layer.parentLayerId,
      zIndex: layer.zIndex,
      timing: layer.timing,
      opacity: layer.opacity / 100,
      visible: layer.opacity > 0,
      localMatrix,
      worldMatrix: localMatrix,
      matrix2D: shapeTransformMatrix2D(layer.transform),
      content: {
        kind: "shape" as const,
        shape: layer.payload.shape,
        width: layer.frame.width,
        height: layer.frame.height,
        fill: typeof layer.style.fill === "string"
          ? layer.style.fill
          : layer.style.fill.stops[0]!.color,
        ...(gradientFill ? { fillPaint: gradientFill } : {}),
        ...(layer.payload.cornerRadius !== undefined
          ? {
              cornerRadius: Math.min(
                layer.payload.cornerRadius,
                layer.frame.width / 2,
                layer.frame.height / 2,
              ),
            }
          : {}),
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
      },
    };
  });

  return {
    format: "motion-runtime",
    formatVersion: 2,
    id: project.id,
    composition: {
      width: project.composition.width,
      height: project.composition.height,
      fps: project.composition.fps,
      background: project.composition.background,
      graphId: project.id,
    },
    view: projection,
    nodes,
  };
}

/** Compile V2 and evaluate one frame into the backend-neutral paint contract. */
export function compileProtocolV2ToPaintCommands(
  input: unknown,
  options: { frame?: number; time?: number } = {},
): PaintCommandBuffer {
  const runtime = compileProtocolV2(input);
  const frame = options.frame ??
    (options.time == null
      ? 0
      : frameIndexAtTime(options.time, runtime.composition.fps));
  return evaluateRuntimeProjectV2(runtime, frame, {
    ...(options.time != null ? { time: options.time } : {}),
  });
}
