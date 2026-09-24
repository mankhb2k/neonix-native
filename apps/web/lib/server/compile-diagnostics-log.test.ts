import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { logCompileDiagnostics } from "./compile-diagnostics-log";

describe("logCompileDiagnostics", () => {
  it("logs only error-severity diagnostics, as code + message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logCompileDiagnostics([
      { severity: "error", code: "css-animation-transform-conflict", message: "conflict" },
      { severity: "warning", code: "css-unused-asset", message: "ignored" },
    ]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      "[html-compile-diagnostic]",
      JSON.stringify({ code: "css-animation-transform-conflict", message: "conflict" }),
    );
    spy.mockRestore();
  });

  it("never includes the source HTML/CSS, only the diagnostic's own code and message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logCompileDiagnostics([{ severity: "error", code: "html-inline-style-unsupported", message: "no inline style" }]);
    const logged = spy.mock.calls[0]?.[1] as string;
    expect(JSON.parse(logged)).toEqual({ code: "html-inline-style-unsupported", message: "no inline style" });
    spy.mockRestore();
  });

  it("logs nothing when there are no error diagnostics", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logCompileDiagnostics([{ severity: "warning", code: "css-unused-asset", message: "ignored" }]);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
