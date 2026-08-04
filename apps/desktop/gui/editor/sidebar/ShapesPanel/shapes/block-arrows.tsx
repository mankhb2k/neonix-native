import { DEFAULT_FRAME_DURATION } from "@motionvideo/editor-core";
import type { ShapeCategory } from "./types";

export const BLOCK_ARROW_SHAPES_CATEGORY: ShapeCategory = {
  title: "Mũi tên khối",
  items: [
    {
      id: "arrow-right",
      label: "Mũi tên phải",
      payload: {
        id: "shape-arrow-right",
        kind: "shape",
        label: "Mũi tên phải",
        shape: "polygon",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <svg
          className="h-[28px] w-[28px] fill-none stroke-current stroke-2"
          viewBox="0 0 24 24"
        >
          <polygon points="1.5,8 13.5,8 13.5,2.5 22.5,12 13.5,21.5 13.5,16 1.5,16" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "arrow-left",
      label: "Mũi tên trái",
      payload: {
        id: "shape-arrow-left",
        kind: "shape",
        label: "Mũi tên trái",
        shape: "polygon",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <svg
          className="h-[28px] w-[28px] fill-none stroke-current stroke-2"
          viewBox="0 0 24 24"
        >
          <polygon points="22.5,8 10.5,8 10.5,2.5 1.5,12 10.5,21.5 10.5,16 22.5,16" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "arrow-up",
      label: "Mũi tên lên",
      payload: {
        id: "shape-arrow-up",
        kind: "shape",
        label: "Mũi tên lên",
        shape: "polygon",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <svg
          className="h-[28px] w-[28px] fill-none stroke-current stroke-2"
          viewBox="0 0 24 24"
        >
          <polygon points="8,22.5 8,10.5 2.5,10.5 12,1.5 21.5,10.5 16,10.5 16,22.5" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "arrow-down",
      label: "Mũi tên xuống",
      payload: {
        id: "shape-arrow-down",
        kind: "shape",
        label: "Mũi tên xuống",
        shape: "polygon",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <svg
          className="h-[28px] w-[28px] fill-none stroke-current stroke-2"
          viewBox="0 0 24 24"
        >
          <polygon points="8,1.5 8,13.5 2.5,13.5 12,22.5 21.5,13.5 16,13.5 16,1.5" strokeLinejoin="round" />
        </svg>
      ),
    },
  ],
};
