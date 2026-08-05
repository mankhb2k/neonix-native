import { describe, expect, it } from "vitest";
import {
  createEmptyEnvelope,
  isPropertyLocked,
  markUserModified,
  toggleElementLock,
  togglePropertyLock,
} from "@/lib/editor/authoring/web-project-envelope";

describe("web project envelope locks", () => {
  it("locks element and property paths", () => {
    let envelope = createEmptyEnvelope("proj_1");
    envelope = togglePropertyLock(
      envelope,
      "scene.a",
      "node.t",
      "transform.x",
      true,
    );
    expect(isPropertyLocked(envelope, "scene.a", "node.t", "transform.x")).toBe(
      true,
    );
    expect(isPropertyLocked(envelope, "scene.a", "node.t", "transform.y")).toBe(
      false,
    );

    envelope = toggleElementLock(envelope, "scene.a", "node.t", true);
    expect(isPropertyLocked(envelope, "scene.a", "node.t", "transform.y")).toBe(
      true,
    );
  });

  it("tracks user-modified properties", () => {
    let envelope = createEmptyEnvelope("proj_1");
    envelope = markUserModified(envelope, "scene.a", "node.t", [
      "transform.x",
      "text.text",
    ]);
    const meta =
      envelope.authoring.elementMeta["scene:scene.a:node.t"];
    expect(meta?.userModifiedProperties).toEqual([
      "transform.x",
      "text.text",
    ]);
    expect(meta?.origin).toBe("user");
  });
});
