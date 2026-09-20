import { ImageResponse } from "next/og";

export const alt = "Neonix — HTML to motion video";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          backgroundColor: "#f7f7f4",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              backgroundColor: "#0d9488",
            }}
          />
          <div style={{ fontSize: 32, fontWeight: 600, color: "#171717" }}>
            Neonix
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 60,
              fontWeight: 700,
              color: "#171717",
              lineHeight: 1.05,
              maxWidth: 980,
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            HTML and CSS&nbsp;
            <span style={{ color: "#0f766e" }}>&rarr; motion video.</span>
          </div>
          <div style={{ fontSize: 28, color: "#555555", maxWidth: 860 }}>
            An HTML-to-motion-video compiler for AI agents — connect Claude,
            ChatGPT or Grok over Remote MCP.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            fontSize: 22,
            color: "#e2e8f4",
            backgroundColor: "#0b0e16",
            padding: "14px 20px",
            borderRadius: 10,
            fontFamily: "monospace",
          }}
        >
          create_project_html(html, css) {"->"} motion.mp4
        </div>
      </div>
    ),
    { ...size },
  );
}
