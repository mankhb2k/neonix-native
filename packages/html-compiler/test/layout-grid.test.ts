import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

function compile(children: string, css: string) {
  const result = compileHtmlCss(createHtmlCssSource({ html: `<body>${children}</body>`, css }));
  expect(result.status).toBe("success");
  return result.protocol!;
}

function layer(protocol: ReturnType<typeof compile>, id: string) {
  const found = protocol.layers.find((item) => item.id === id);
  expect(found).toBeDefined();
  return found!;
}

describe("HTML/CSS compiler P1.3 explicit grid", () => {
  it("resolves explicit px and fr columns with row-major placement", () => {
    const protocol = compile(
      `<div id="grid"><div id="one"></div><div id="two"></div><div id="three"></div><div id="four"></div></div>`,
      `#grid { position: absolute; left: 200px; top: 200px; width: 900px; height: 500px; display: grid; grid-template-columns: 200px 1fr 2fr; grid-template-rows: 140px 140px; column-gap: 20px; row-gap: 20px; }
       #one, #two, #three, #four { background: #38bdf8; }`,
    );
    expect(layer(protocol, "one")).toMatchObject({ frame: { width: 200, height: 140 }, transform: { translate: { x: 0, y: 0, z: 0 } } });
    expect(layer(protocol, "two")).toMatchObject({ frame: { width: 220, height: 140 }, transform: { translate: { x: 220, y: 0, z: 0 } } });
    expect(layer(protocol, "three")).toMatchObject({ frame: { width: 440, height: 140 }, transform: { translate: { x: 460, y: 0, z: 0 } } });
    expect(layer(protocol, "four")).toMatchObject({ frame: { width: 200, height: 140 }, transform: { translate: { x: 0, y: 160, z: 0 } } });
  });

  it("stretches a text item to its grid cell just like a shape item in the neighboring cell", () => {
    // grid layout tests elsewhere only ever use empty colored divs as
    // items - this confirms a text leaf gets the same default stretch
    // sizing from its track as a shape sibling, instead of collapsing to
    // its own intrinsic size inside the cell.
    const fontAssets = [{ id: "inter-regular", kind: "font" as const, uri: "/fonts/inter.ttf", weight: 400, style: "normal" as const, integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", family: "Inter" }];
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<body><div id="grid"><div id="shape"></div><div id="label">Hi</div></div></body>`,
      css: `#grid { position: absolute; left: 0px; top: 0px; width: 400px; height: 140px; display: grid; grid-template-columns: 200px 200px; grid-template-rows: 140px; }
            #shape { background: #38bdf8; }
            #label { font-family: Inter; font-size: 20px; }`,
    }), { fontAssets });
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((item) => item.id === "shape")).toMatchObject({ frame: { width: 200, height: 140 }, transform: { translate: { x: 0, y: 0 } } });
    expect(result.protocol?.layers.find((item) => item.id === "label")).toMatchObject({ type: "text", frame: { width: 200, height: 140 }, transform: { translate: { x: 200, y: 0 } } });
  });

  it("places items on explicit grid lines", () => {
    const protocol = compile(
      `<div id="grid"><div id="hero"></div><div id="side"></div><div id="footer"></div></div>`,
      `#grid { position: absolute; left: 200px; top: 200px; width: 800px; height: 600px; display: grid; grid-template-columns: 180px 220px 180px; grid-template-rows: 120px 160px 140px; gap: 20px; }
       #hero { grid-column-start: 1; grid-column-end: 3; grid-row-start: 1; grid-row-end: 2; background: #22d3ee; }
       #side { grid-column-start: 3; grid-column-end: 4; grid-row-start: 1; grid-row-end: 3; background: #a78bfa; }
       #footer { grid-column-start: 1; grid-column-end: 2; grid-row-start: 3; grid-row-end: 4; background: #fb7185; }`,
    );
    expect(layer(protocol, "hero")).toMatchObject({ frame: { width: 420, height: 120 }, transform: { translate: { x: 0, y: 0, z: 0 } } });
    expect(layer(protocol, "side")).toMatchObject({ frame: { width: 180, height: 300 }, transform: { translate: { x: 440, y: 0, z: 0 } } });
    expect(layer(protocol, "footer")).toMatchObject({ frame: { width: 180, height: 140 }, transform: { translate: { x: 0, y: 320, z: 0 } } });
  });

  it("resolves gaps, place-items and track-area alignment", () => {
    const protocol = compile(
      `<div id="grid"><div id="one"></div><div id="two"></div><div id="three"></div><div id="four"></div></div>`,
      `#grid { position: absolute; left: 200px; top: 200px; width: 700px; height: 500px; display: grid; grid-template-columns: 200px 200px; grid-template-rows: 120px 120px; column-gap: 20px; row-gap: 30px; justify-content: center; align-content: flex-end; place-items: center; }
       #one, #two, #three, #four { width: 100px; height: 60px; background: #4ade80; }`,
    );
    expect(layer(protocol, "one")).toMatchObject({ transform: { translate: { x: 190, y: 260, z: 0 } } });
    expect(layer(protocol, "two")).toMatchObject({ transform: { translate: { x: 410, y: 260, z: 0 } } });
    expect(layer(protocol, "three")).toMatchObject({ transform: { translate: { x: 190, y: 410, z: 0 } } });
  });

  it("expands grid placement shorthands and spans", () => {
    const protocol = compile(
      `<div id="grid"><div id="hero"></div><div id="side"></div></div>`,
      `#grid { position: absolute; left: 200px; top: 200px; width: 800px; height: 500px; display: grid; grid-template-columns: 180px 1fr 1fr; grid-template-rows: 160px 160px; gap: 20px; }
       #hero { grid-column: 1 / span 2; grid-row: 1 / span 2; background: #38bdf8; }
       #side { grid-column: 3 / 4; grid-row: 1 / 3; background: #fb7185; }`,
    );
    expect(layer(protocol, "hero")).toMatchObject({ frame: { width: 490, height: 340 }, transform: { translate: { x: 0, y: 0, z: 0 } } });
    expect(layer(protocol, "side")).toMatchObject({ frame: { width: 290, height: 340 }, transform: { translate: { x: 510, y: 0, z: 0 } } });
  });

  it("supports auto tracks from fixed item sizes", () => {
    const protocol = compile(
      `<div id="grid"><div id="one"></div><div id="two"></div></div>`,
      `#grid { position: absolute; left: 200px; top: 200px; width: 600px; height: 400px; display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto 1fr; gap: 20px; }
       #one { width: 140px; height: 80px; background: #38bdf8; }
       #two { width: 100px; height: 60px; background: #a78bfa; }`,
    );
    expect(layer(protocol, "one")).toMatchObject({ frame: { width: 140, height: 80 }, transform: { translate: { x: 0, y: 0, z: 0 } } });
    expect(layer(protocol, "two")).toMatchObject({ transform: { translate: { x: 160, y: 0, z: 0 } } });
  });

  it("applies order before grid auto-placement", () => {
    const protocol = compile(
      `<div id="grid"><div id="first"></div><div id="second"></div><div id="third"></div></div>`,
      `#grid { position: absolute; left: 200px; top: 200px; width: 600px; height: 200px; display: grid; grid-template-columns: repeat(3, 160px); grid-template-rows: 100px; column-gap: 20px; }
       #first { order: 3; background: #38bdf8; } #second { order: 1; background: #a78bfa; } #third { order: 2; background: #fb7185; }`,
    );
    expect(layer(protocol, "second")).toMatchObject({ transform: { translate: { x: 0, y: 0, z: 0 } } });
    expect(layer(protocol, "third")).toMatchObject({ transform: { translate: { x: 180, y: 0, z: 0 } } });
    expect(layer(protocol, "first")).toMatchObject({ transform: { translate: { x: 360, y: 0, z: 0 } } });
  });

  it("uses the grid padding box for absolute children and preserves contents parent", () => {
    const protocol = compile(
      `<div id="grid"><div id="contents"><div id="cell"></div></div><div id="absolute"></div></div>`,
      `#grid { position: absolute; left: 200px; top: 200px; width: 600px; height: 300px; padding: 20px; display: grid; grid-template-columns: 200px; grid-template-rows: 120px; overflow: hidden; }
       #contents { display: contents; }
       #cell { background: #38bdf8; }
       #absolute { position: absolute; left: 30px; top: 40px; width: 80px; height: 60px; background: #fb7185; }`,
    );
    expect(layer(protocol, "cell")).toHaveProperty("parentLayerId", "grid");
    expect(layer(protocol, "absolute")).toMatchObject({ transform: { translate: { x: 30, y: 40, z: 0 } } });
    expect(protocol.clipPaths).toHaveLength(1);
  });
});
