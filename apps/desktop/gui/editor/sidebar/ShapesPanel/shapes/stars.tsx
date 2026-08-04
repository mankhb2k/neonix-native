import { DEFAULT_FRAME_DURATION } from "@motionvideo/editor-core";
import type { ShapeCategory } from "./types";

export const STAR_SHAPES_CATEGORY: ShapeCategory = {
  title: "Hình ngôi sao",
  items: [
    {
      id: "star-4",
      label: "Ngôi sao 4 cánh",
      payload: {
        id: "shape-star-4",
        kind: "shape",
        label: "Ngôi sao 4 cánh",
        shape: "polygon",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <svg
          className="h-[28px] w-[28px] fill-none stroke-current stroke-2"
          viewBox="0 0 24 24"
        >
          <polygon points="12,1.5 15,9 22.5,12 15,15 12,22.5 9,15 1.5,12 9,9" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "star-5",
      label: "Ngôi sao 5 cánh",
      payload: {
        id: "shape-star-5",
        kind: "shape",
        label: "Ngôi sao 5 cánh",
        shape: "polygon",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <svg
          className="h-[28px] w-[28px] fill-none stroke-current stroke-2"
          viewBox="0 0 24 24"
        >
          <polygon points="12,1.5 15.2,8.5 22.5,9.2 17.2,14.2 18.8,22.5 12,18.2 5.2,22.5 6.8,14.2 1.5,9.2 8.8,8.5" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "star-6",
      label: "Ngôi sao 6 cánh",
      payload: {
        id: "shape-star-6",
        kind: "shape",
        label: "Ngôi sao 6 cánh",
        shape: "polygon",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <svg
          className="h-[28px] w-[28px] fill-none stroke-current stroke-2"
          viewBox="0 0 24 24"
        >
          <polygon points="12,1.5 14.8,7.2 21,5.2 18.2,11.8 22.5,16 15.8,16 13,22.5 10.2,16 3.5,16 7.8,11.8 5,5.2 11.2,7.2" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "star-8",
      label: "Ngôi sao 8 cánh",
      payload: {
        id: "shape-star-8",
        kind: "shape",
        label: "Ngôi sao 8 cánh",
        shape: "polygon",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <svg
          className="h-[28px] w-[28px] fill-none stroke-current stroke-2"
          viewBox="0 0 24 24"
        >
          <polygon points="12,1.5 14.5,7 20,4.2 17.2,9.8 22.5,12 17.2,14.2 20,19.8 14.5,17 12,22.5 9.5,17 4,19.8 6.8,14.2 1.5,12 6.8,9.8 4,4.2 9.5,7" strokeLinejoin="round" />
        </svg>
      ),
    },
  ],
};
