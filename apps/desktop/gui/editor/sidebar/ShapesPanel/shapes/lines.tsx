import { DEFAULT_FRAME_DURATION } from "@motionvideo/editor-core";
import type { ShapeCategory } from "./types";

export const LINE_SHAPES_CATEGORY: ShapeCategory = {
  title: "Đường thẳng & Đường nét",
  items: [
    {
      id: "line-straight",
      label: "Đường thẳng",
      payload: {
        id: "shape-line-straight",
        kind: "shape",
        label: "Đường thẳng",
        shape: "polygon",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <svg
          className="h-[28px] w-[28px] fill-none stroke-current stroke-2"
          viewBox="0 0 24 24"
        >
          <line x1="2" y1="12" x2="22" y2="12" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "line-arrow",
      label: "Đường mũi tên",
      payload: {
        id: "shape-line-arrow",
        kind: "shape",
        label: "Đường mũi tên",
        shape: "polygon",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <svg
          className="h-[28px] w-[28px] fill-none stroke-current stroke-2"
          viewBox="0 0 24 24"
        >
          <line x1="2" y1="12" x2="21" y2="12" strokeLinecap="round" />
          <polyline points="15,6 21,12 15,18" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "line-dashed",
      label: "Đường nét đứt",
      payload: {
        id: "shape-line-dashed",
        kind: "shape",
        label: "Đường nét đứt",
        shape: "polygon",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <svg
          className="h-[28px] w-[28px] fill-none stroke-current stroke-2"
          viewBox="0 0 24 24"
        >
          <line x1="2" y1="12" x2="22" y2="12" strokeDasharray="4 3" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "line-double-arrow",
      label: "Mũi tên hai đầu",
      payload: {
        id: "shape-line-double-arrow",
        kind: "shape",
        label: "Mũi tên hai đầu",
        shape: "polygon",
        duration: DEFAULT_FRAME_DURATION,
      },
      icon: (
        <svg
          className="h-[28px] w-[28px] fill-none stroke-current stroke-2"
          viewBox="0 0 24 24"
        >
          <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
          <polyline points="8,6 2,12 8,18" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="16,6 22,12 16,18" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ],
};
