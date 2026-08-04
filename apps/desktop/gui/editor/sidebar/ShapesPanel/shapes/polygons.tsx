import { DEFAULT_FRAME_DURATION } from "@motionvideo/editor-core";
import type { ShapeCategory } from "./types";

export const POLYGON_SHAPES_CATEGORY: ShapeCategory = {
  title: "Đa giác",
  items: [
    {
      id: "poly-pentagon",
      label: "Ngũ giác",
      payload: {
        id: "shape-pentagon",
        kind: "shape",
        label: "Ngũ giác",
        shape: "polygon",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <svg
          className="h-[28px] w-[28px] fill-none stroke-current stroke-2"
          viewBox="0 0 24 24"
        >
          <polygon points="12,1.5 22.5,9 18.5,22.5 5.5,22.5 1.5,9" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "poly-hexagon-v",
      label: "Lục giác đứng",
      payload: {
        id: "shape-hexagon-v",
        kind: "shape",
        label: "Lục giác đứng",
        shape: "polygon",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <svg
          className="h-[28px] w-[28px] fill-none stroke-current stroke-2"
          viewBox="0 0 24 24"
        >
          <polygon points="12,1.5 21.5,6.5 21.5,17.5 12,22.5 2.5,17.5 2.5,6.5" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "poly-hexagon-h",
      label: "Lục giác ngang",
      payload: {
        id: "shape-hexagon-h",
        kind: "shape",
        label: "Lục giác ngang",
        shape: "polygon",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <svg
          className="h-[28px] w-[28px] fill-none stroke-current stroke-2"
          viewBox="0 0 24 24"
        >
          <polygon points="6.5,2.5 17.5,2.5 22.5,12 17.5,21.5 6.5,21.5 1.5,12" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "poly-octagon",
      label: "Bát giác",
      payload: {
        id: "shape-octagon",
        kind: "shape",
        label: "Bát giác",
        shape: "polygon",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <svg
          className="h-[28px] w-[28px] fill-none stroke-current stroke-2"
          viewBox="0 0 24 24"
        >
          <polygon points="7.5,1.5 16.5,1.5 22.5,7.5 22.5,16.5 16.5,22.5 7.5,22.5 1.5,16.5 1.5,7.5" strokeLinejoin="round" />
        </svg>
      ),
    },
  ],
};
