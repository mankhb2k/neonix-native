import type { MotionProject } from "@motionvideo/motion-schema";

export type TemplateMeta = {
  id: string;
  name: string;
  industry: string;
  locale: "vi-VN";
  duration: number;
  aspectRatio: "9:16" | "16:9" | "1:1";
  grammar: Array<"hook" | "pain" | "benefit" | "demo" | "offer" | "cta" | "logo">;
  tags: string[];
  motionBlocks: string[];
};

export type Template = TemplateMeta & {
  project: MotionProject;
};
