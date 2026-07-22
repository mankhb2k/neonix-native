import type { MotionBlock } from "../../types";

function cameraPreset(
  role: string,
  name: string,
  nameVi: string,
  description: string,
  duration: number,
): MotionBlock {
  return {
    id: `camera.${role}`,
    name,
    nameVi,
    family: "animation",
    kind: "camera",
    intent: "camera",
    shelf: "camera-presets",
    description,
    duration,
    durationMin: Math.max(0.3, duration * 0.5),
    durationMax: Math.max(duration * 2, 2),
    preset: `camera-${role}`,
    tags: ["animation", "camera", role, "core"],
    sampleText: "",
    previewClass: `mv-block-cam mv-block-cam-${role}`,
  };
}

export const CAMERA_ZOOM_IN = cameraPreset(
  "zoom-in",
  "Zoom In",
  "Zoom vào",
  "Phóng to viewport về tâm (hoặc focus point). Hero / product.",
  1.2,
);

export const CAMERA_ZOOM_OUT = cameraPreset(
  "zoom-out",
  "Zoom Out",
  "Zoom ra",
  "Thu nhỏ viewport — reveal toàn cảnh.",
  1.2,
);

export const CAMERA_PAN_LEFT = cameraPreset(
  "pan-left",
  "Pan Left",
  "Quay trái",
  "Trượt camera sang trái.",
  1,
);

export const CAMERA_PAN_RIGHT = cameraPreset(
  "pan-right",
  "Pan Right",
  "Quay phải",
  "Trượt camera sang phải.",
  1,
);

export const CAMERA_PAN_UP = cameraPreset(
  "pan-up",
  "Pan Up",
  "Quay lên",
  "Trượt camera lên trên.",
  1,
);

export const CAMERA_PAN_DOWN = cameraPreset(
  "pan-down",
  "Pan Down",
  "Quay xuống",
  "Trượt camera xuống dưới.",
  1,
);

export const CAMERA_FOCUS_TARGET = cameraPreset(
  "focus-target",
  "Focus Target",
  "Lấy nét mục tiêu",
  "Zoom/pan nhẹ về một layer (cần targetLayerId sau).",
  1.1,
);

export const CAMERA_FOLLOW_OBJECT = cameraPreset(
  "follow-object",
  "Follow Object",
  "Theo đối tượng",
  "Camera bám layer đang move (cần targetLayerId sau).",
  1.5,
);

export const CAMERA_SHAKE = cameraPreset(
  "shake",
  "Shake",
  "Rung",
  "Rung khung — impact / nhấn mạnh. Dùng sparingly.",
  0.45,
);

export const CAMERA_ROTATE = cameraPreset(
  "rotate",
  "Rotate",
  "Xoay",
  "Xoay nhẹ viewport — transition sáng tạo.",
  1,
);

/** Animation · Camera Presets shelf */
export const CAMERA_PRESET_BLOCKS: MotionBlock[] = [
  CAMERA_ZOOM_IN,
  CAMERA_ZOOM_OUT,
  CAMERA_PAN_LEFT,
  CAMERA_PAN_RIGHT,
  CAMERA_PAN_UP,
  CAMERA_PAN_DOWN,
  CAMERA_FOCUS_TARGET,
  CAMERA_FOLLOW_OBJECT,
  CAMERA_SHAKE,
  CAMERA_ROTATE,
];

/** @deprecated alias */
export const CAMERA_BLOCKS = CAMERA_PRESET_BLOCKS;
