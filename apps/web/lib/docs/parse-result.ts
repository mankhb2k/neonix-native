import { parseMotionProtocol } from "@motionvideo/motion-protocol";

export type ParseAttempt = {
  ok: boolean;
  message: string;
};

export function attemptParse(input: unknown): ParseAttempt {
  try {
    parseMotionProtocol(input);
    return { ok: true, message: "Protocol V2 accepted this JSON." };
  } catch (err) {
    const message =
      err instanceof Error ? err.message.slice(0, 400) : String(err);
    return { ok: false, message };
  }
}
