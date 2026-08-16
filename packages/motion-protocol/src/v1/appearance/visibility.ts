/**
 * Layer có được render hay không. Không định nghĩa hit-test hay selection.
 */
import { z } from "zod";

export const VisibilitySchema = z.boolean();

export type Visibility = z.infer<typeof VisibilitySchema>;
