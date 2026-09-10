import { describe, expect, it } from "vitest";
import { compileDocument } from "../src";

describe("HTML text character references", () => {
  it("matches browser text-node decoding for named and numeric references", () => {
    const result = compileDocument({
      html: `<!doctype html>
        <html><head>
          <meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":640,"height":360,"fps":30,"background":"#081018","colorSpace":"srgb"}}'>
          <style>
            html, body { width: 640px; height: 360px; margin: 0; background: #081018; color: #ffffff; font-family: Inter; }
            #copy { position: absolute; left: 20px; top: 20px; font-size: 24px; }
          </style>
        </head><body><p id="copy">01&nbsp;&amp;&nbsp;Reset &#x1F30A;</p></body></html>`,
      fontAssets: [{
        id: "inter-regular",
        kind: "font",
        uri: "/preview/font/Inter/Inter_18pt-Regular.ttf",
        weight: 400,
        style: "normal",
        family: "Inter",
        integrity: "sha256:3e5f90a0138b38de4cf4d779ad78391974ea1df776b9164842bdcbb60ce383c5",
      }],
    });

    expect(result.status).toBe("success");
    const text = result.protocol?.layers.find((layer) => layer.type === "text");
    expect(text?.type).toBe("text");
    if (text?.type !== "text") return;
    expect(text.payload.source.text).toBe("01\u00a0&\u00a0Reset 🌊");
  });
});
