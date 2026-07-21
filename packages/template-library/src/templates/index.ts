import type { Template } from "../types";

/** Seed templates — expand per vertical later */
export const templates: Template[] = [
  {
    id: "fnb-hook-offer-cta-v1",
    name: "F&B Hook → Offer → CTA",
    industry: "fnb",
    locale: "vi-VN",
    duration: 20,
    aspectRatio: "9:16",
    grammar: ["hook", "offer", "cta"],
    tags: ["cà phê", "đồ uống", "khuyến mãi", "tiktok"],
    motionBlocks: ["text.fade-up", "price-pop", "cta-slide", "logo-reveal"],
    project: {
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
              animations: [{ preset: "price-pop", start: 0, duration: 0.6 }],
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
              animations: [{ preset: "cta-slide", start: 0, duration: 0.7 }],
            },
            {
              id: "logo",
              type: "logo",
              x: 0,
              y: 0,
              animations: [{ preset: "logo-reveal", start: 0.4, duration: 0.8 }],
            },
          ],
        },
      ],
    },
  },
];
