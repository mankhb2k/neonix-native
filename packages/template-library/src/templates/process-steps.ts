import type { Template } from "../types";

export const processStepsV1: Template = {
  id: "process-steps-v1",
  name: "Process Steps",
  industry: "education",
  locale: "vi-VN",
  duration: 15,
  aspectRatio: "9:16",
  grammar: ["hook", "demo", "cta"],
  tags: ["quy trình", "bước", "infographic", "học"],
  motionBlocks: ["enter.fade-up"],
  project: {
    version: 1,
    id: "process-steps-v1",
    locale: "vi-VN",
    aspectRatio: "9:16",
    industry: "education",
    brand: {
      name: "Brand",
      primaryColor: "#5B2C6F",
      fontFamily: "Be Vietnam Pro",
    },
    scenes: [
      {
        id: "step-1",
        role: "hook",
        duration: 4,
        layers: [
          {
            id: "s1",
            type: "text",
            content: "1. Thu thập dữ liệu",
            x: 0,
            y: 0,
            animations: [{ preset: "fade-up", start: 0, duration: 0.7 }],
          },
        ],
      },
      {
        id: "step-2",
        role: "demo",
        duration: 4,
        layers: [
          {
            id: "s2",
            type: "text",
            content: "2. Phân tích & làm sạch",
            x: 0,
            y: 0,
            animations: [{ preset: "fade-up", start: 0, duration: 0.7 }],
          },
        ],
      },
      {
        id: "step-3",
        role: "demo",
        duration: 4,
        layers: [
          {
            id: "s3",
            type: "text",
            content: "3. Kết luận hành động",
            x: 0,
            y: 0,
            animations: [{ preset: "fade-up", start: 0, duration: 0.7 }],
          },
        ],
      },
      {
        id: "cta",
        role: "cta",
        duration: 3,
        layers: [
          {
            id: "cta-text",
            type: "text",
            content: "Thử quy trình ngay",
            x: 0,
            y: 0,
            animations: [{ preset: "slide-up", start: 0, duration: 0.65 }],
          },
        ],
      },
    ],
  },
};
