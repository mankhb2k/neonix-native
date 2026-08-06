/**
 * Orthographic camera view matrix — matches render-worker applyCameraView.
 * View: T(center) · R(-rotation) · S(zoom) · T(-cameraPosition)
 */

import {
  multiplyMatrix,
  rotationMatrix,
  scaleMatrix,
  translationMatrix,
  type Matrix2D,
} from "./matrix";

export type CameraViewParams = {
  x: number;
  y: number;
  rotation: number;
  zoom: number;
};

export function cameraViewMatrix(
  camera: CameraViewParams,
  width: number,
  height: number,
): Matrix2D {
  return multiplyMatrix(
    multiplyMatrix(
      multiplyMatrix(
        translationMatrix(width / 2, height / 2),
        rotationMatrix(-camera.rotation),
      ),
      scaleMatrix(camera.zoom, camera.zoom),
    ),
    translationMatrix(-camera.x, -camera.y),
  );
}
