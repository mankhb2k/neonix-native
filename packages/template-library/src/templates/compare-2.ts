import type { Template } from "../types";
import { createTemplateProject } from "./factory";

export const compare2: Template = {
  id: "compare-2-v2",
  name: "Compare A vs B",
  industry: "retail",
  locale: "vi-VN",
  duration: 12,
  aspectRatio: "9:16",
  grammar: ["hook", "benefit", "cta"],
  tags: ["so sánh", "vs", "infographic"],
  motionBlocks: ["enter.slide-left", "enter.slide-right", "enter.fade-up"],
  project: createTemplateProject({
    id: "compare-2-v2",
    name: "Compare A vs B",
    industry: "retail",
    primaryColor: "#B85C38",
    scenes: [
      { id: "compare", role: "hook", duration: 7, nodes: [
        { id: "title", text: "Cũ vs Mới", y: -120, preset: "fade-up" },
        { id: "col-a", text: "Cũ: chậm · đắt", x: -40, y: 20, preset: "slide-right", start: 0.2 },
        { id: "col-b", text: "Mới: nhanh · tiết kiệm", x: 40, y: 80, preset: "slide-left", start: 0.35 },
      ] },
      { id: "cta", role: "cta", duration: 5, nodes: [
        { id: "cta-text", text: "Chọn cái mới hôm nay", preset: "pop" },
      ] },
    ],
  }),
};
