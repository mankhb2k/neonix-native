import { DEFAULT_FRAME_DURATION } from "@motionvideo/editor-core";
import type { ShapeCategory } from "./types";

export const BASIC_SHAPES_CATEGORY: ShapeCategory = {
  title: "Hình dạng cơ bản",
  items: [
    {
      id: "basic-square",
      label: "Hình vuông",
      payload: {
        id: "shape-square",
        kind: "shape",
        label: "Hình vuông",
        shape: "rectangle",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <div className="h-[28px] w-[28px] border-2 border-current rounded-none bg-transparent" />
      ),
    },
    {
      id: "basic-rounded-rect",
      label: "Hình chữ nhật bo góc",
      payload: {
        id: "shape-rounded-rect",
        kind: "shape",
        label: "Hình bo góc",
        shape: "rectangle",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <div className="h-[28px] w-[28px] border-2 border-current rounded-md bg-transparent" />
      ),
    },
    {
      id: "basic-circle",
      label: "Hình tròn",
      payload: {
        id: "shape-circle",
        kind: "shape",
        label: "Hình tròn",
        shape: "ellipse",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <div className="h-[28px] w-[28px] border-2 border-current rounded-full bg-transparent" />
      ),
    },
    {
      id: "basic-triangle",
      label: "Hình tam giác",
      payload: {
        id: "shape-triangle",
        kind: "shape",
        label: "Hình tam giác",
        shape: "polygon",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <svg
          className="h-[28px] w-[28px] fill-none stroke-current stroke-2"
          viewBox="0 0 24 24"
        >
          <polygon points="12,1.5 22.5,22.5 1.5,22.5" strokeLinejoin="round" />
        </svg>
      ),
    },
  ],
};
