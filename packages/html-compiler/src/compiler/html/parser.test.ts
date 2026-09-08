import { describe, expect, it } from "vitest";
import { parseHtml } from "./parser";

describe("HTML parser domain", () => {
  it("keeps nested content order and stable explicit identities", () => {
    const root = parseHtml(`<body><p id="title">Hello <strong>world</strong><br>!</p></body>`);
    const body = root.children[0]!;
    const paragraph = body.children[0]!;

    expect(paragraph.atomicId).toBe("title");
    expect(paragraph.content.map((part) => typeof part === "string" ? part : part.tag)).toEqual(["Hello ", "strong", "br", "!"]);
    expect(paragraph.children.map((child) => child.tag)).toEqual(["strong", "br"]);
  });
});
