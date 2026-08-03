import { describe, expect, it, vi } from "vitest";
import type { LibraryPayload } from "../model/library-payload";
import { commitLibraryPayload } from "./commit-library-payload";

const TEXT: LibraryPayload = {
  kind: "text",
  id: "title",
  label: "Title",
  text: "Hello",
  duration: 3,
};

describe("commitLibraryPayload", () => {
  it("uses the default target for keyboard/click commits", () => {
    const execute = vi.fn();
    commitLibraryPayload(TEXT, { mode: "click" }, execute);

    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]?.[0]).toMatchObject({
      type: "add-clip-draft",
      target: { track: "main" },
    });
  });

  it("reuses the exact placement resolved by the drag gesture", () => {
    const execute = vi.fn();
    const placement = {
      track: "overlay" as const,
      laneId: "overlay-2",
      startTime: 4.25,
    };

    commitLibraryPayload(TEXT, { mode: "drag", placement }, execute);

    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]?.[0]).toMatchObject({
      type: "add-clip-draft",
      target: placement,
    });
  });
});
