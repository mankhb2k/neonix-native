import type { Template } from "../types";
import { createTemplateProject } from "./factory";

export const bigNumber: Template = {
  id: "big-number",
  name: "Big Number",
  industry: "saas",
  locale: "vi-VN",
  duration: 12,
  aspectRatio: "9:16",
  grammar: ["hook", "benefit", "cta"],
  tags: ["số liệu", "infographic", "counter", "tiktok"],
  motionBlocks: ["text.counter", "enter.scale-in", "enter.fade-up"],
  project: createTemplateProject({
    id: "big-number",
    name: "Big Number",
    industry: "saas",
    primaryColor: "#0F4C81",
    scenes: [
      { id: "number", role: "hook", duration: 5, nodes: [
        { id: "big-num", text: "10000", y: -40, preset: "counter", duration: 1.4 },
        { id: "caption", text: "khách hàng tin dùng", y: 60, preset: "fade-up", start: 0.6 },
      ] },
      { id: "punch", role: "benefit", duration: 4, nodes: [
        { id: "punch-text", text: "Tăng trưởng rõ ràng", preset: "scale-in" },
      ] },
      { id: "cta", role: "cta", duration: 3, nodes: [
        { id: "cta-text", text: "Bắt đầu miễn phí", preset: "slide-up" },
      ] },
    ],
  }),
};
