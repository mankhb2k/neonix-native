/** Frame draft types for timeline commands — no localStorage. */

export const DEFAULT_FRAME_DURATION = 5;

export type FrameDraft = {
  id: string;
  name: string;
  role?: string;
  duration: number;
  text: string;
};
