import { describe, expect, it } from "vitest";
import { compileHtmlCss } from "./compile";
import { createHtmlCssSource } from "../../source";

describe("compile pipeline", () => {
  it("keeps the pipeline entrypoint Protocol V2 compatible", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<body><div id="card"></div></body>`,
      css: `#card { position: absolute; left: 20px; top: 30px; width: 100px; height: 60px; background: #2563eb; }`,
    }));

    expect(result.status).toBe("success");
    expect(result.protocol?.layers.map((layer) => layer.id)).toEqual(["card"]);
    expect(result.protocol?.composition).toMatchObject({ width: 1920, height: 1080, fps: 30 });
  });
});
