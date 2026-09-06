import {
  createMatrix4,
  matrix4ToArray,
  multiplyMatrix4,
  scaleMatrix3D,
  translationMatrix3D,
  type RuntimeFrameV3,
} from "@motionvideo/motion-runtime";
import type { StagePreviewOverrides } from "@/lib/store/stage-interaction-store";

/** Apply transient editor transforms after runtime evaluation and before paint. */
export function applyStagePreviewOverrides(
  frame: RuntimeFrameV3,
  overrides: StagePreviewOverrides,
): RuntimeFrameV3 {
  if (overrides.size === 0) return frame;
  let changed = false;
  const commands = frame.commands.map((command) => {
    if (command.op !== "setTransform" || !command.layerId) return command;
    const override = overrides.get(command.layerId);
    if (!override) return command;
    const { x, y } = override.translateDelta;
    const scaleX = override.scaleMultiplier?.x ?? 1;
    const scaleY = override.scaleMultiplier?.y ?? 1;
    const hasScale = Number.isFinite(scaleX) && Number.isFinite(scaleY) && (scaleX !== 1 || scaleY !== 1);
    const hasTranslation = Number.isFinite(x) && Number.isFinite(y) && (x !== 0 || y !== 0);
    if (!hasScale && !hasTranslation) return command;
    changed = true;
    let matrix = createMatrix4(command.matrix4);
    if (hasScale) {
      const origin = override.scaleOrigin ?? { x: 0, y: 0 };
      matrix = multiplyMatrix4(
        translationMatrix3D(origin.x, origin.y, 0),
        multiplyMatrix4(
          scaleMatrix3D(scaleX, scaleY, 1),
          multiplyMatrix4(translationMatrix3D(-origin.x, -origin.y, 0), matrix),
        ),
      );
    }
    if (hasTranslation) matrix = multiplyMatrix4(translationMatrix3D(x, y, 0), matrix);
    return { ...command, matrix4: matrix4ToArray(matrix) };
  });
  return changed ? { ...frame, commands } : frame;
}
