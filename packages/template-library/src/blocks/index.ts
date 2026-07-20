export type MotionBlock = {
  id: string;
  name: string;
  kind: "text" | "logo" | "transition" | "cta" | "icon";
  tags: string[];
};

export const motionBlocks: MotionBlock[] = [
  { id: "text-fade-up", name: "Text Fade Up", kind: "text", tags: ["kinetic", "vi"] },
  { id: "logo-reveal", name: "Logo Reveal", kind: "logo", tags: ["brand"] },
  { id: "price-pop", name: "Price Pop", kind: "cta", tags: ["offer"] },
  { id: "cta-slide", name: "CTA Slide", kind: "cta", tags: ["cta"] },
];
