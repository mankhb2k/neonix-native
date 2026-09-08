import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

function compile(sourceHtml: string, css: string) {
  const result = compileHtmlCss(createHtmlCssSource({ html: `<body>${sourceHtml}</body>`, css }));
  expect(result.status).toBe("success");
  return result.protocol!;
}

function layer(protocol: ReturnType<typeof compile>, id: string) {
  const found = protocol.layers.find((item) => item.id === id);
  expect(found).toBeDefined();
  return found!;
}

describe("HTML/CSS compiler P1.1 flex layout", () => {
  it("places fixed row items in the content box", () => {
    const protocol = compile(
      `<div id="row"><div id="a"></div><div id="b"></div><div id="c"></div></div>`,
      `#row { position: absolute; left: 200px; top: 300px; width: 900px; height: 200px; display: flex; }
       #a, #b, #c { width: 200px; height: 80px; }
       #a { background: #38bdf8; } #b { background: #a78bfa; } #c { background: #facc15; }`,
    );
    expect(layer(protocol, "a")).toMatchObject({ frame: { width: 200, height: 80 }, transform: { translate: { x: 0, y: 0, z: 0 } } });
    expect(layer(protocol, "b")).toMatchObject({ transform: { translate: { x: 200, y: 0, z: 0 } } });
    expect(layer(protocol, "c")).toMatchObject({ transform: { translate: { x: 400, y: 0, z: 0 } } });
  });

  it("uses the main-axis gap for a column", () => {
    const protocol = compile(
      `<div id="column"><div id="a"></div><div id="b"></div><div id="c"></div></div>`,
      `#column { position: absolute; left: 200px; top: 200px; width: 400px; height: 600px; display: flex; flex-direction: column; gap: 24px; }
       #a, #b, #c { width: 120px; height: 80px; background: #22d3ee; }`,
    );
    expect(layer(protocol, "a")).toMatchObject({ transform: { translate: { x: 0, y: 0, z: 0 } } });
    expect(layer(protocol, "b")).toMatchObject({ transform: { translate: { x: 0, y: 104, z: 0 } } });
    expect(layer(protocol, "c")).toMatchObject({ transform: { translate: { x: 0, y: 208, z: 0 } } });
  });

  it("distributes free space and resolves align-self", () => {
    const protocol = compile(
      `<div id="distribution"><div id="a"></div><div id="b"></div><div id="c"></div></div>`,
      `#distribution { position: absolute; left: 200px; top: 200px; width: 900px; height: 300px; display: flex; justify-content: space-between; align-items: center; }
       #a, #b, #c { width: 100px; height: 80px; background: #38bdf8; }
       #b { align-self: flex-end; }`,
    );
    expect(layer(protocol, "a")).toMatchObject({ transform: { translate: { x: 0, y: 110, z: 0 } } });
    expect(layer(protocol, "b")).toMatchObject({ transform: { translate: { x: 400, y: 220, z: 0 } } });
    expect(layer(protocol, "c")).toMatchObject({ transform: { translate: { x: 800, y: 110, z: 0 } } });
  });

  it("expands flex shorthand and distributes grow factors", () => {
    const protocol = compile(
      `<div id="grow"><div id="one"></div><div id="two"></div></div>`,
      `#grow { position: absolute; left: 200px; top: 200px; width: 600px; height: 120px; display: flex; gap: 20px; }
       #one { flex: 1; background: #38bdf8; } #two { flex: 2; background: #a78bfa; }`,
    );
    expect(layer(protocol, "one")).toMatchObject({ frame: { width: 193.33333333333334, height: 120 } });
    expect(layer(protocol, "two")).toMatchObject({ frame: { width: 386.6666666666667, height: 120 }, transform: { translate: { y: 0, z: 0 } } });
    expect(layer(protocol, "two").transform.translate.x).toBeCloseTo(213.33333333333334, 8);
  });

  it("places items by order before lowering layers", () => {
    const protocol = compile(
      `<div id="ordering"><div id="first"></div><div id="second"></div><div id="third"></div></div>`,
      `#ordering { position: absolute; left: 200px; top: 200px; width: 900px; height: 120px; display: flex; gap: 20px; }
       #first { order: 3; width: 100px; height: 80px; background: #38bdf8; }
       #second { order: 1; width: 100px; height: 80px; background: #a78bfa; }
       #third { order: 2; width: 100px; height: 80px; background: #fb7185; }`,
    );
    expect(layer(protocol, "second")).toMatchObject({ transform: { translate: { x: 0, y: 0, z: 0 } } });
    expect(layer(protocol, "third")).toMatchObject({ transform: { translate: { x: 120, y: 0, z: 0 } } });
    expect(layer(protocol, "first")).toMatchObject({ transform: { translate: { x: 240, y: 0, z: 0 } } });
  });

  it("forms multiple lines and applies row and column gaps", () => {
    const protocol = compile(
      `<div id="wrap"><div id="one"></div><div id="two"></div><div id="three"></div><div id="four"></div></div>`,
      `#wrap { position: absolute; left: 200px; top: 200px; width: 900px; height: 400px; display: flex; flex-wrap: wrap; align-content: flex-start; align-items: flex-start; row-gap: 30px; column-gap: 20px; }
       #one, #two, #three, #four { width: 280px; height: 100px; background: #38bdf8; }`,
    );
    expect(layer(protocol, "one")).toMatchObject({ transform: { translate: { x: 0, y: 0, z: 0 } } });
    expect(layer(protocol, "three")).toMatchObject({ transform: { translate: { x: 600, y: 0, z: 0 } } });
    expect(layer(protocol, "four")).toMatchObject({ transform: { translate: { x: 0, y: 130, z: 0 } } });
  });

  it("distributes cross-axis free space with align-content", () => {
    const protocol = compile(
      `<div id="align"><div id="one"></div><div id="two"></div><div id="three"></div><div id="four"></div><div id="five"></div><div id="six"></div></div>`,
      `#align { position: absolute; left: 200px; top: 200px; width: 900px; height: 500px; display: flex; flex-wrap: wrap; align-content: space-between; align-items: center; column-gap: 20px; row-gap: 20px; }
       #one, #two, #three, #four, #five, #six { width: 280px; height: 80px; background: #a78bfa; }`,
    );
    expect(layer(protocol, "one")).toMatchObject({ transform: { translate: { x: 0, y: 0, z: 0 } } });
    expect(layer(protocol, "four")).toMatchObject({ transform: { translate: { x: 0, y: 420, z: 0 } } });
    expect(layer(protocol, "six")).toMatchObject({ transform: { translate: { x: 600, y: 420, z: 0 } } });
  });

  it("reverses line order for wrap-reverse", () => {
    const protocol = compile(
      `<div id="reverse"><div id="one"></div><div id="two"></div><div id="three"></div><div id="four"></div></div>`,
      `#reverse { position: absolute; left: 200px; top: 200px; width: 800px; height: 500px; display: flex; flex-wrap: wrap-reverse; align-content: flex-start; align-items: flex-start; row-gap: 20px; column-gap: 20px; }
       #one, #two, #three, #four { width: 340px; height: 100px; background: #fb7185; }`,
    );
    expect(layer(protocol, "one")).toMatchObject({ transform: { translate: { x: 0, y: 400, z: 0 } } });
    expect(layer(protocol, "three")).toMatchObject({ transform: { translate: { x: 0, y: 280, z: 0 } } });
  });

  it("applies relative offsets after flex placement and keeps min/max inside the line", () => {
    const protocol = compile(
      `<div id="edge"><div id="relative"></div><div id="bounded"></div></div>`,
      `#edge { position: absolute; left: 200px; top: 200px; width: 600px; height: 120px; display: flex; gap: 20px; }
       #relative { position: relative; left: 30px; top: 12px; width: 100px; height: 60px; background: #38bdf8; }
       #bounded { flex: 1; min-width: 300px; max-width: 340px; background: #a78bfa; }`,
    );
    expect(layer(protocol, "relative")).toMatchObject({ transform: { translate: { x: 30, y: 12, z: 0 } } });
    expect(layer(protocol, "bounded")).toMatchObject({ frame: { width: 340, height: 120 } });
  });

  it("uses the flex container padding box for absolute children", () => {
    const protocol = compile(
      `<div id="container"><div id="absolute"></div></div>`,
      `#container { left: 200px; top: 200px; width: 500px; height: 300px; padding: 20px; display: flex; overflow: hidden; }
       #absolute { position: absolute; left: 40px; top: 30px; width: 100px; height: 80px; background: #fb7185; }`,
    );
    expect(layer(protocol, "absolute")).toMatchObject({ frame: { width: 100, height: 80 }, transform: { translate: { x: 40, y: 30, z: 0 } } });
    expect(protocol.clipPaths).toHaveLength(1);
    expect(protocol.clipPaths?.[0]).toMatchObject({ children: [{ type: "rect", width: 540, height: 340 }] });
  });

  it("does not collapse margins and flattens display contents into the flex parent", () => {
    const protocol = compile(
      `<div id="container"><div id="contents"><div id="first"></div></div><div id="second"></div></div>`,
      `#container { position: absolute; left: 200px; top: 200px; width: 600px; height: 160px; display: flex; align-items: flex-start; }
       #contents { display: contents; }
       #first { width: 100px; height: 80px; margin-right: 30px; background: #38bdf8; }
       #second { width: 100px; height: 80px; margin-left: 40px; background: #a78bfa; }`,
    );
    expect(layer(protocol, "first")).toHaveProperty("parentLayerId", "container");
    expect(layer(protocol, "second")).toMatchObject({ transform: { translate: { x: 170, y: 0, z: 0 } } });
  });
});
