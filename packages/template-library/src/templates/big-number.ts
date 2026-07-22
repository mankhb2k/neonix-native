import type { Template } from "../types";

export const bigNumberV1: Template = {
  id: "big-number-v1",
  name: "Big Number",
  industry: "saas",
  locale: "vi-VN",
  duration: 12,
  aspectRatio: "9:16",
  grammar: ["hook", "benefit", "cta"],
  tags: ["số liệu", "infographic", "counter", "tiktok"],
  motionBlocks: ["text.counter", "enter.scale-in", "enter.fade-up"],
  project: {
    version: 1,
    id: "big-number-v1",
    locale: "vi-VN",
    aspectRatio: "9:16",
    industry: "saas",
    brand: {
      name: "Brand",
      primaryColor: "#0F4C81",
      fontFamily: "Be Vietnam Pro",
    },
    scenes: [
      {
        id: "number",
        role: "hook",
        duration: 5,
        layers: [
          {
            id: "big-num",
            type: "text",
            content: "10000",
            x: 0,
            y: -40,
            animations: [{ preset: "counter", start: 0, duration: 1.4 }],
          },
          {
            id: "caption",
            type: "text",
            content: "khách hàng tin dùng",
            x: 0,
            y: 60,
            animations: [
              { preset: "fade-up", start: 0.4, duration: 0.7, delay: 0.2 },
            ],
          },
        ],
      },
      {
        id: "punch",
        role: "benefit",
        duration: 4,
        layers: [
          {
            id: "punch-text",
            type: "text",
            content: "Tăng trưởng rõ ràng",
            x: 0,
            y: 0,
            animations: [{ preset: "scale-in", start: 0, duration: 0.6 }],
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
            content: "Bắt đầu miễn phí",
            x: 0,
            y: 0,
            animations: [{ preset: "slide-up", start: 0, duration: 0.65 }],
          },
        ],
      },
    ],
  },
};
