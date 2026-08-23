import type { z } from "zod";
import type { V2Composition } from "./composition";
import type { V2Asset } from "./assets";
import type { V2AudioDomain } from "./audio";
import { V2LayerSchema } from "./layers";

export type MotionProtocolV2 = {
  format: "motion-protocol";
  formatVersion: 2;
  id: string;
  composition: V2Composition;
  assets: Array<V2Asset>;
  layers: Array<z.infer<typeof V2LayerSchema>>;
  audio: V2AudioDomain;
};
