import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../index";

describe("HTML composition tag vocabulary", () => {
  it("lowers video-oriented text and container tags", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<body>
        <section id="scene">
          <h1 id="title">Hello <strong>Neonix</strong><br>World</h1>
          <p id="description">A <em>deterministic</em> composition.</p>
          <figure id="figure"><img id="poster" src="/poster.png"><figcaption id="caption">Caption</figcaption></figure>
        </section>
      </body>`,
      css: `
        #scene { position: absolute; left: 0; top: 0; width: 1200px; height: 800px; }
        #title { position: absolute; left: 100px; top: 80px; width: 800px; height: 180px; color: #ffffff; font-family: TestSans; font-size: 64px; }
        #description { position: absolute; left: 100px; top: 300px; width: 800px; height: 80px; color: #ffffff; font-family: TestSans; font-size: 32px; }
        #figure { position: absolute; left: 100px; top: 420px; width: 400px; height: 300px; }
        #poster { width: 400px; height: 240px; }
        #caption { width: 400px; height: 60px; color: #ffffff; font-family: TestSans; }
      `,
    }), {
      fontAssets: [
        { id: "sans-regular", kind: "font", uri: "/fonts/sans-regular.ttf", mimeType: "font/ttf", family: "TestSans", weight: 400, style: "normal", integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        { id: "sans-bold", kind: "font", uri: "/fonts/sans-bold.ttf", mimeType: "font/ttf", family: "TestSans", weight: 700, style: "normal", integrity: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
      ],
    });

    expect(result.status).toBe("success");
    expect(result.protocol?.layers.filter((layer) => layer.type === "text").map((layer) => layer.id)).toEqual([
      "title",
      "description",
      "caption",
    ]);
    expect(result.protocol?.layers.some((layer) => layer.type === "image" && layer.id === "poster")).toBe(true);
  });

  it("lowers common SVG primitives to canonical path layers", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<body><svg id="scene"><rect id="card" x="10" y="20" width="120" height="60" rx="8"/><circle id="dot" cx="200" cy="50" r="20"/><line id="rule" x1="240" y1="20" x2="340" y2="20"/><polygon id="triangle" points="380,20 440,80 320,80"/></svg></body>`,
      css: `
        #scene { position: absolute; left: 0; top: 0; width: 600px; height: 200px; }
        #card { fill: #2563eb; }
        #dot { fill: #22c55e; }
        #rule { fill: none; stroke: #ffffff; stroke-width: 4px; }
        #triangle { fill: #f97316; }
      `,
    }));

    expect(result.status).toBe("success");
    expect(result.protocol?.layers.filter((layer) => layer.type === "path").map((layer) => layer.id)).toEqual([
      "card",
      "dot",
      "rule",
      "triangle",
    ]);
  });

  it("lowers audio into the protocol audio timeline", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<body><audio id="music" src="/music.mp3"></audio></body>`,
      css: "",
    }), {
      composition: { durationMs: 5000 },
      mediaAssets: [{ uri: "/music.mp3", kind: "audio", duration: 4500, mimeType: "audio/mpeg" }],
    });

    expect(result.status).toBe("success");
    expect(result.protocol?.assets).toContainEqual(expect.objectContaining({ id: "music-asset", kind: "audio", uri: "/music.mp3" }));
    expect(result.protocol?.audio.tracks).toMatchObject([{
      id: "music",
      clips: [{ assetId: "music-asset", timing: { start: 0, duration: 4500 }, trim: { start: 0, end: 4500 } }],
    }]);
  });
});
