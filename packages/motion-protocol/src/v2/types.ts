import type { z } from "zod";
import type { V2Composition } from "./composition";
import { V2LayerSchema } from "./layers";

export type MotionProtocolV2 = {
  format: "motion-protocol";
  formatVersion: 2;
  id: string;
  composition: V2Composition;
  layers: Array<z.infer<typeof V2LayerSchema>>;
};
