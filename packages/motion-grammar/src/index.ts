export type SceneRole =
  | "hook"
  | "pain"
  | "benefit"
  | "demo"
  | "offer"
  | "cta"
  | "logo";

export type GrammarPattern = {
  id: string;
  name: string;
  roles: SceneRole[];
  industries: string[];
};

export const grammarPatterns: GrammarPattern[] = [
  {
    id: "hook-offer-cta",
    name: "Hook → Offer → CTA",
    roles: ["hook", "offer", "cta"],
    industries: ["fnb", "spa", "retail"],
  },
  {
    id: "hook-pain-benefit-cta",
    name: "Hook → Pain → Benefit → CTA",
    roles: ["hook", "pain", "benefit", "cta"],
    industries: ["saas", "service"],
  },
  {
    id: "logo-tagline-feature-cta",
    name: "Logo → Tagline → Feature → CTA",
    roles: ["logo", "hook", "benefit", "cta"],
    industries: ["saas", "app"],
  },
];

export function getGrammarForIndustry(industry: string): GrammarPattern[] {
  return grammarPatterns.filter((g) => g.industries.includes(industry));
}
