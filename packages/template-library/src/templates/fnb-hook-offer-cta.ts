import type { Template } from "../types";
import { createTemplateProject } from "./factory";

export const fnbHookOfferCta: Template = {
  id: "fnb-hook-offer-cta",
  name: "F&B Hook → Offer → CTA",
  industry: "fnb",
  locale: "vi-VN",
  duration: 20,
  aspectRatio: "9:16",
  grammar: ["hook", "offer", "cta"],
  tags: ["cà phê", "đồ uống", "khuyến mãi", "tiktok"],
  motionBlocks: ["enter.fade-up", "enter.pop", "enter.slide-up", "enter.fade-in"],
  project: createTemplateProject({
    id: "fnb-hook-offer-cta",
    name: "F&B Hook Offer CTA",
    industry: "fnb",
    primaryColor: "#1A5D3A",
    scenes: [
      { id: "hook", role: "hook", duration: 5, nodes: [
        { id: "hook-text", text: "Cà phê ngon mỗi sáng", preset: "fade-up", duration: 0.8 },
      ] },
      { id: "offer", role: "offer", duration: 8, nodes: [
        { id: "offer-text", text: "Giảm 30% hôm nay", preset: "pop", duration: 0.6 },
      ] },
      { id: "cta", role: "cta", duration: 7, nodes: [
        { id: "cta-text", text: "Ghé quán ngay", preset: "slide-up" },
        { id: "logo", type: "logo", y: 80, preset: "fade-in", start: 0.4 },
      ] },
    ],
  }),
};
