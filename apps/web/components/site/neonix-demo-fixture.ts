import {
  compileDocument,
} from "@motionvideo/html-compiler";

const NEONIX_DEMO_FONT_ASSETS = [
  {
    id: "neonix-demo-roboto-regular",
    kind: "font" as const,
    uri: "/preview/font/Roboto/Roboto-Regular.ttf",
    weight: 400,
    integrity: "sha256:15256405ecb0d880678833a582760efad538ab2932318b52c8105b267d159459",
    family: "Roboto",
    style: "normal" as const,
    mimeType: "font/ttf" as const,
  },
  {
    id: "neonix-demo-roboto-bold",
    kind: "font" as const,
    uri: "/preview/font/Roboto/Roboto-Bold.ttf",
    weight: 700,
    integrity: "sha256:4aaf8c5b661a386998c2e70cf2b87e2440f5404e0b8fd81164f0413fb3435ec6",
    family: "Roboto",
    style: "normal" as const,
    mimeType: "font/ttf" as const,
  },
] as const;

const NEONIX_DEMO_BODY = `<main id="hero-card">
  <div id="scene-hook" class="neonix-scene">
    <div id="portal-outer"></div>
    <div id="portal-inner"></div>
    <div class="scene-kicker">AI MOTION</div>
    <div class="scene-title">Motion video. Made simple.</div>
    <div class="scene-subtitle">Turn an idea into motion.</div>
  </div>
  <div id="scene-ai" class="neonix-scene">
    <div id="ai-orb"></div>
    <div id="layer-text" class="layer-card">TEXT</div>
    <div id="layer-shape" class="layer-card">SHAPE</div>
    <div id="layer-color" class="layer-card">COLOR</div>
    <div class="scene-kicker">AI DESIGN</div>
    <div class="scene-title">Designed by AI. Editable by you.</div>
    <div class="scene-subtitle">From first frame to final export.</div>
  </div>
  <div id="scene-compiler" class="neonix-scene">
    <div id="code-card"></div>
    <div id="compiler-beam"></div>
    <div id="json-card"></div>
    <div class="scene-kicker">HTML + CSS</div>
    <div class="scene-title">Web source into editable motion.</div>
    <div class="scene-subtitle">Semantic JSON. Every layer.</div>
  </div>
  <div id="scene-mcp" class="neonix-scene">
    <div id="chat-bubble">Create a neon product video</div>
    <div id="mcp-node">MCP</div>
    <div id="agent-node">AI</div>
    <div class="scene-kicker">NEONIX MCP</div>
    <div class="scene-title">Create inside your chatbot.</div>
    <div class="scene-subtitle">Prompt to project in one flow.</div>
  </div>
  <div id="scene-final" class="neonix-scene">
    <div id="brand-mark">NEONIX</div>
    <div id="final-title">Prompt to video in under a minute.</div>
    <div id="final-cta">START WITH NEONIX MCP</div>
  </div>
  <div id="timeline-track"></div>
  <div id="timeline-progress"></div>
</main>`;

export const NEONIX_DEMO_CSS = `#hero-card {
  position: relative;
  width: 1080px;
  height: 1920px;
  overflow: hidden;
  background: linear-gradient(145deg, #050810 0%, #132738 58%, #5a2d38 100%);
  color: #f8fafc;
  font-family: Roboto;
  font-size: 16px;
}

@keyframes neonix-scene-cycle {
  0%, 2% { opacity: 0; transform: translateY(36px) scale(0.96); }
  5%, 16% { opacity: 1; transform: translateY(0px) scale(1); }
  22%, 100% { opacity: 0; transform: translateY(-36px) scale(1.04); }
}

@keyframes neonix-orbit {
  from { opacity: 0.45; transform: scale(0.92) rotate(-5deg); }
  to { opacity: 1; transform: scale(1.04) rotate(5deg); }
}

@keyframes neonix-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

.neonix-scene {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 1080px;
  height: 1920px;
  opacity: 0;
  animation-name: neonix-scene-cycle;
  animation-duration: 20000ms;
  animation-iteration-count: infinite;
  animation-fill-mode: both;
  animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1);
}

#scene-hook { animation-delay: 0ms; }
#scene-ai { animation-delay: 4000ms; }
#scene-compiler { animation-delay: 8000ms; }
#scene-mcp { animation-delay: 12000ms; }
#scene-final { animation-delay: 16000ms; }

.scene-kicker {
  position: absolute;
  left: 120px;
  top: 1210px;
  width: 840px;
  height: 48px;
  color: #5eead4;
  font-size: 22px;
  letter-spacing: 0.18em;
}

.scene-title {
  position: absolute;
  left: 120px;
  top: 1285px;
  width: 840px;
  height: 190px;
  color: #f8fafc;
  font-size: 72px;
  font-weight: 700;
  line-height: 1;
}

.scene-subtitle {
  position: absolute;
  left: 120px;
  top: 1510px;
  width: 840px;
  height: 70px;
  color: #94a3b8;
  font-size: 30px;
}

#portal-outer {
  position: absolute;
  left: 150px;
  top: 220px;
  width: 780px;
  height: 780px;
  border: 5px solid #5eead4;
  border-radius: 999px;
  transform-origin: center;
  animation-name: neonix-orbit;
  animation-duration: 1800ms;
  animation-iteration-count: infinite;
  animation-direction: alternate;
  animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1);
}

#portal-inner {
  position: absolute;
  left: 285px;
  top: 355px;
  width: 510px;
  height: 510px;
  border: 10px solid #fbbf24;
  border-radius: 999px;
}

#ai-orb {
  position: absolute;
  left: 390px;
  top: 330px;
  width: 300px;
  height: 300px;
  border: 8px solid #2bc7fb;
  border-radius: 999px;
  background: #132738;
  transform-origin: center;
  animation-name: neonix-orbit;
  animation-duration: 1200ms;
  animation-iteration-count: infinite;
  animation-direction: alternate;
  animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1);
}

.layer-card {
  position: absolute;
  width: 230px;
  height: 100px;
  border: 3px solid #5eead4;
  border-radius: 24px;
  background: #101828;
  color: #f8fafc;
  font-size: 24px;
  text-align: center;
}

#layer-text { left: 110px; top: 300px; }
#layer-shape { left: 740px; top: 520px; }
#layer-color { left: 150px; top: 760px; border-color: #f472b6; }

#code-card, #json-card {
  position: absolute;
  top: 300px;
  width: 380px;
  height: 520px;
  border: 4px solid #2bc7fb;
  border-radius: 32px;
  background: #0b1320;
}

#code-card { left: 80px; }
#json-card { left: 620px; border-color: #5eead4; }

#compiler-beam {
  position: absolute;
  left: 475px;
  top: 550px;
  width: 130px;
  height: 12px;
  border-radius: 999px;
  background: #fbbf24;
}

#chat-bubble {
  position: absolute;
  left: 110px;
  top: 330px;
  width: 500px;
  height: 210px;
  padding: 42px;
  border: 4px solid #2bc7fb;
  border-radius: 38px;
  background: #101828;
  color: #f8fafc;
  font-size: 32px;
}

#mcp-node, #agent-node {
  position: absolute;
  width: 170px;
  height: 170px;
  border: 5px solid #5eead4;
  border-radius: 999px;
  background: #132738;
  color: #f8fafc;
  font-size: 34px;
  text-align: center;
}

#mcp-node { left: 680px; top: 600px; }
#agent-node { left: 440px; top: 820px; border-color: #f472b6; }

#brand-mark {
  position: absolute;
  left: 240px;
  top: 480px;
  width: 600px;
  height: 100px;
  color: #5eead4;
  font-size: 42px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-align: center;
}

#final-title {
  position: absolute;
  left: 140px;
  top: 690px;
  width: 800px;
  height: 260px;
  color: #f8fafc;
  font-size: 78px;
  font-weight: 700;
  line-height: 1;
  text-align: center;
}

#final-cta {
  position: absolute;
  left: 270px;
  top: 1080px;
  width: 540px;
  height: 110px;
  border: 4px solid #5eead4;
  border-radius: 999px;
  background: #0f766e;
  color: #ffffff;
  font-size: 24px;
  font-weight: 700;
  text-align: center;
}

#timeline-track, #timeline-progress {
  position: absolute;
  left: 120px;
  top: 1790px;
  width: 840px;
  height: 8px;
  border-radius: 999px;
}

#timeline-track { background: #334155; }

#timeline-progress {
  background: #fbbf24;
  transform-origin: left center;
  animation-name: neonix-progress;
  animation-duration: 20000ms;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
}`;

export const NEONIX_DEMO_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="neonix-document"
      content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1080,"height":1920,"fps":30,"background":"#050810","colorSpace":"srgb"}}'
    />
    <style data-neonix-bundle>
${NEONIX_DEMO_CSS}
    </style>
  </head>
  <body>
${NEONIX_DEMO_BODY}
  </body>
</html>`;

export const NEONIX_DEMO_COMPILED = compileDocument({
  html: NEONIX_DEMO_HTML,
  fontAssets: NEONIX_DEMO_FONT_ASSETS,
}, {
  composition: {
    durationMs: 20000,
    id: "neonix-demo-hero",
  },
});

export const NEONIX_DEMO_JSON = JSON.stringify(
  NEONIX_DEMO_COMPILED.protocol ?? {
    status: NEONIX_DEMO_COMPILED.status,
    diagnostics: NEONIX_DEMO_COMPILED.diagnostics,
  },
  null,
  2,
);
