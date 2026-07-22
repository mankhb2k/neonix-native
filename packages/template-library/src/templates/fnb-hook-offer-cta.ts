import type { Template } from "../types";

export const fnbHookOfferCta: Template = {
  id: "fnb-hook-offer-cta-v1",
  name: "F&B Hook → Offer → CTA",
  industry: "fnb",
  locale: "vi-VN",
  duration: 20,
  aspectRatio: "9:16",
  grammar: ["hook", "offer", "cta"],
  tags: ["cà phê", "đồ uống", "khuyến mãi", "tiktok"],
  motionBlocks: ["enter.fade-up", "enter.pop", "enter.slide-up", "enter.fade-in"],
  project: {
    version: 1,
    id: "fnb-hook-offer-cta-v1",
    locale: "vi-VN",
    aspectRatio: "9:16",
    industry: "fnb",
    brand: {
      name: "Brand",
      primaryColor: "#1A5D3A",
      fontFamily: "Be Vietnam Pro",
    },
    scenes: [
      {
        id: "hook",
        role: "hook",
        duration: 5,
        layers: [
          {
            id: "hook-text",
            type: "text",
            content: "Cà phê ngon mỗi sáng",
            x: 0,
            y: 0,
            animations: [{ preset: "fade-up", start: 0, duration: 0.8 }],
          },
        ],
      },
      {
        id: "offer",
        role: "offer",
        duration: 8,
        layers: [
          {
            id: "offer-text",
            type: "text",
            content: "Giảm 30% hôm nay",
            x: 0,
            y: 0,
            animations: [{ preset: "pop", start: 0, duration: 0.6 }],
          },
        ],
      },
      {
        id: "cta",
        role: "cta",
        duration: 7,
        layers: [
          {
            id: "cta-text",
            type: "text",
            content: "Ghé quán ngay",
            x: 0,
            y: 0,
            animations: [{ preset: "slide-up", start: 0, duration: 0.7 }],
          },
          {
            id: "logo",
            type: "logo",
            x: 0,
            y: 40,
            animations: [{ preset: "fade-in", start: 0.4, duration: 0.8 }],
          },
        ],
      },
    ],
  },
};
