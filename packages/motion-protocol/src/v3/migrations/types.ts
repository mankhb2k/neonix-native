/**
 * Migration-internal v2 types not exported by the v2 barrel.
 */
import { z } from "zod";
import { AudioTrackSchema } from "../../v2/project";

export type AudioTrackV2 = z.infer<typeof AudioTrackSchema>;
