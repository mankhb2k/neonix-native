import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Classname helper for desktop UI primitives (no app/store knowledge). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
