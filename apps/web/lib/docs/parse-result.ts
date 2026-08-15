import { parseMotionProjectV1 } from "@motionvideo/motion-protocol";

export type ParseAttempt = {
  ok: boolean;
  message: string;
};

export function attemptParse(input: unknown): ParseAttempt {
  try {
    parseMotionProjectV1(input);
    return { ok: true, message: "parseMotionProjectV1 accepted this JSON." };
  } catch (err) {
    const message =
      err instanceof Error ? err.message.slice(0, 400) : String(err);
    return { ok: false, message };
  }
}
