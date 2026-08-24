import { describe, expect, it } from "vitest";
import { formatStepperValue, getStepperNextValue } from "./StepperInput";

describe("StepperInput integer UI", () => {
  it("rounds only the displayed value for integer fields", () => {
    expect(formatStepperValue(-1.20533, true)).toBe("-1");
    expect(formatStepperValue(760.5, true)).toBe("761");
  });

  it("keeps the exact protocol value available for non-integer fields", () => {
    expect(formatStepperValue(1.20533)).toBe("1.20533");
  });

  it("steps from the rounded UI value instead of a hidden float", () => {
    expect(getStepperNextValue(71.95, 1, 1, true)).toBe(73);
    expect(getStepperNextValue(71.95, -1, 1, true)).toBe(71);
  });
});
