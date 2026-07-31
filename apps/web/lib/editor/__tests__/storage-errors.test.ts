import { describe, expect, it } from "vitest";
import {
  SaveProjectError,
  isQuotaExceededError,
} from "@/lib/editor/persistence/storage-errors";

describe("storage errors", () => {
  it("detects QuotaExceededError by name", () => {
    const err = new DOMException("quota", "QuotaExceededError");
    expect(isQuotaExceededError(err)).toBe(true);
  });

  it("wraps quota into SaveProjectError", () => {
    const wrapped = new SaveProjectError("quota", "quota");
    expect(wrapped.code).toBe("quota");
    expect(wrapped.name).toBe("SaveProjectError");
  });
});
