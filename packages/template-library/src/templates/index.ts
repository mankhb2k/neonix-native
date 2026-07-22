import type { Template } from "../types";
import { bigNumberV1 } from "./big-number";
import { compare2V1 } from "./compare-2";
import { fnbHookOfferCta } from "./fnb-hook-offer-cta";
import { processStepsV1 } from "./process-steps";

/** Seed templates — expand per vertical later */
export const templates: Template[] = [
  fnbHookOfferCta,
  bigNumberV1,
  processStepsV1,
  compare2V1,
];

export { bigNumberV1, compare2V1, fnbHookOfferCta, processStepsV1 };
