import { describe, it, expect } from "vitest";
import { sha256Hex } from "./sha256";

// Reference vectors generated with Node's `createHash("sha256")`.
const VECTORS: Array<[input: string, expected: string]> = [
  ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
  [
    "motion-capabilities:v1",
    "462209f0ce91223ef12afddf3573725e607660f754de5b38b2f75a049311a1b3",
  ],
  [
    "hello world",
    "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
  ],
  [
    "The quick brown fox jumps over the lazy dog",
    "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
  ],
];

describe("sha256Hex (pure-JS, isomorphic)", () => {
  it("matches Node crypto reference vectors", () => {
    for (const [input, expected] of VECTORS) {
      expect(sha256Hex(input)).toBe(expected);
    }
  });

  it("handles multi-block inputs (>64 bytes)", () => {
    const long = "a".repeat(200);
    // Only structural sanity: 64 hex chars, deterministic.
    expect(sha256Hex(long)).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex(long)).toBe(sha256Hex(long));
  });

  it("accepts raw bytes and matches the string form", () => {
    const bytes = new TextEncoder().encode("abc");
    expect(sha256Hex(bytes)).toBe(VECTORS[1]![1]);
  });
});
