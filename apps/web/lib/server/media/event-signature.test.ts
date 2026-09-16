import { describe, expect, it } from "vitest";
import { signMediaEvent, verifyMediaEventSignature } from "./event-signature";

describe("media event signature", () => {
  it("verifies the timestamped raw body and rejects tampering", () => {
    const secret = "phase2-secret";
    const timestamp = "1700000000";
    const body = JSON.stringify({ object: { key: "media/ws/asset/origin.mp4" } });
    const signature = signMediaEvent(secret, timestamp, body);

    expect(verifyMediaEventSignature(secret, timestamp, signature, body, 1700000000)).toBe(true);
    expect(verifyMediaEventSignature(secret, timestamp, signature, `${body} `, 1700000000)).toBe(false);
    expect(verifyMediaEventSignature(secret, timestamp, signature, body, 1700000401)).toBe(false);
  });
});
