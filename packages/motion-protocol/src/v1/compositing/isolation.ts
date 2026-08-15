/**
 * isolation: auto | isolate. pass-through map sang auto.
 * Isolation của group nằm đây, không nằm payload group.
 */
import { z } from "zod";

export const IsolationSchema = z.enum(["auto", "isolate"]);

export type Isolation = z.infer<typeof IsolationSchema>;
