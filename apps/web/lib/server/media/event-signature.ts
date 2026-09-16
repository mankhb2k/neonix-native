import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_MAX_SKEW_SECONDS = 5 * 60;

export function signMediaEvent(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("base64url");
}

export function verifyMediaEventSignature(
  secret: string,
  timestamp: string,
  signature: string,
  rawBody: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  maxSkewSeconds = DEFAULT_MAX_SKEW_SECONDS,
): boolean {
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds)) return false;
  if (Math.abs(nowSeconds - timestampSeconds) > maxSkewSeconds) return false;

  const expected = Buffer.from(signMediaEvent(secret, timestamp, rawBody));
  const supplied = Buffer.from(signature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
