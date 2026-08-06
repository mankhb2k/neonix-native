import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

function verify(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.replace(/^sha256=/, "");
  return expected === provided;
}

describe("render webhook signature", () => {
  it("rejects forged signatures", () => {
    const body = JSON.stringify({ jobId: "j1", status: "done" });
    expect(verify(body, "sha256=deadbeef", "secret")).toBe(false);
    const good = createHmac("sha256", "secret").update(body).digest("hex");
    expect(verify(body, `sha256=${good}`, "secret")).toBe(true);
  });
});
