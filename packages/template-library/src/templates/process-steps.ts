import type { Template } from "../types";
import { createTemplateProject } from "./factory";

export const processSteps: Template = {
  id: "process-steps-v2",
  name: "Process Steps",
  industry: "education",
  locale: "vi-VN",
  duration: 15,
  aspectRatio: "9:16",
  grammar: ["hook", "demo", "cta"],
  tags: ["quy trình", "bước", "infographic", "học"],
  motionBlocks: ["enter.fade-up"],
  project: createTemplateProject({
    id: "process-steps-v2",
    name: "Process Steps",
    industry: "education",
    primaryColor: "#5B2C6F",
    scenes: [
      { id: "step-1", role: "hook", duration: 4, nodes: [{ id: "s1", text: "1. Thu thập dữ liệu", preset: "fade-up" }] },
      { id: "step-2", role: "demo", duration: 4, nodes: [{ id: "s2", text: "2. Phân tích & làm sạch", preset: "fade-up" }] },
      { id: "step-3", role: "demo", duration: 4, nodes: [{ id: "s3", text: "3. Kết luận hành động", preset: "fade-up" }] },
      { id: "cta", role: "cta", duration: 3, nodes: [{ id: "cta-text", text: "Thử quy trình ngay", preset: "slide-up" }] },
    ],
  }),
};
