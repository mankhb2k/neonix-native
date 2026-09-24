import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { extractHtmlTitle } from "./repository";

describe("extractHtmlTitle", () => {
  it("extracts a plain <title>", () => {
    expect(extractHtmlTitle("<html><head><title>Hello world</title></head></html>")).toBe(
      "Hello world",
    );
  });

  it("decodes common HTML entities and collapses whitespace", () => {
    expect(
      extractHtmlTitle("<title>Tom &amp; Jerry&#39;s  \n  Q&amp;A</title>"),
    ).toBe("Tom & Jerry's Q&A");
  });

  it("returns null when there is no <title>", () => {
    expect(extractHtmlTitle("<html><body>no title here</body></html>")).toBeNull();
  });

  it("returns null for an empty <title>", () => {
    expect(extractHtmlTitle("<title>   </title>")).toBeNull();
  });

  it("is case-insensitive and tolerates attributes on the tag", () => {
    expect(extractHtmlTitle('<TITLE data-x="1">Neonix</TITLE>')).toBe("Neonix");
  });
});
