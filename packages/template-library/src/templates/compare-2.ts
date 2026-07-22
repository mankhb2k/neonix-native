import type { Template } from "../types";

export const compare2V1: Template = {
  id: "compare-2-v1",
  name: "Compare A vs B",
  industry: "retail",
  locale: "vi-VN",
  duration: 12,
  aspectRatio: "9:16",
  grammar: ["hook", "benefit", "cta"],
  tags: ["so sánh", "vs", "infographic"],
  motionBlocks: ["enter.slide-left", "enter.slide-right", "enter.fade-up"],
  project: {
    version: 1,
    id: "compare-2-v1",
    locale: "vi-VN",
    aspectRatio: "9:16",
    industry: "retail",
    brand: {
      name: "Brand",
      primaryColor: "#B85C38",
      fontFamily: "Be Vietnam Pro",
    },
    scenes: [
      {
        id: "compare",
        role: "hook",
        duration: 7,
        layers: [
          {
            id: "title",
            type: "text",
            content: "Cũ vs Mới",
            x: 0,
            y: -120,
            animations: [{ preset: "fade-up", start: 0, duration: 0.55 }],
          },
          {
            id: "col-a",
            type: "text",
            content: "Cũ: chậm · đắt",
            x: -40,
            y: 20,
            animations: [{ preset: "slide-right", start: 0.2, duration: 0.65 }],
          },
          {
            id: "col-b",
            type: "text",
            content: "Mới: nhanh · tiết kiệm",
            x: 40,
            y: 80,
            animations: [{ preset: "slide-left", start: 0.35, duration: 0.65 }],
          },
        ],
      },
      {
        id: "cta",
        role: "cta",
        duration: 5,
        layers: [
          {
            id: "cta-text",
            type: "text",
            content: "Chọn cái mới hôm nay",
            x: 0,
            y: 0,
            animations: [{ preset: "pop", start: 0, duration: 0.55 }],
          },
        ],
      },
    ],
  },
};
