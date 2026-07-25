import type { Template } from "../types";
import { bigNumber } from "./big-number";
import { compare2 } from "./compare-2";
import { fnbHookOfferCta } from "./fnb-hook-offer-cta";
import { processSteps } from "./process-steps";

/** Seed templates — expand per vertical later */
export const templates: Template[] = [
  fnbHookOfferCta,
  bigNumber,
  processSteps,
  compare2,
];

export { bigNumber, compare2, fnbHookOfferCta, processSteps };
