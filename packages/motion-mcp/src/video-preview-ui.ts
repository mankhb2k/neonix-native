/**
 * Small, dependency-free MCP Apps view for exported Neonix videos.
 *
 * Keep this as one HTML resource so MCP hosts can prefetch and sandbox it
 * without needing to execute the Neonix editor application.
 */
export const VIDEO_PREVIEW_RESOURCE_URI = "ui://neonix/video-preview/v1.html";
export const MCP_APP_RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";

export const VIDEO_PREVIEW_UI_HTML = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Neonix video preview</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
        background: var(--color-background-primary, #101114);
        color: var(--color-text-primary, #f6f7f9);
      }
      * { box-sizing: border-box; }
      body { margin: 0; background: transparent; }
      #app { width: 100%; max-width: 720px; margin: 0 auto; padding: 12px; }
      #app.fullscreen { max-width: none; min-height: 100vh; padding: 20px; }
      .shell {
        overflow: hidden;
        border: 1px solid var(--color-border-primary, rgba(127, 127, 127, .25));
        border-radius: var(--border-radius-lg, 16px);
        background: var(--color-background-secondary, rgba(127, 127, 127, .08));
      }
      .header { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
      .title { min-width: 0; flex: 1; }
      .title strong { display: block; font-size: 14px; line-height: 20px; }
      .title span { display: block; overflow: hidden; color: var(--color-text-secondary, #a7abb5); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
      .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
      button, a.button {
        min-height: 36px;
        border: 1px solid var(--color-border-primary, rgba(127, 127, 127, .35));
        border-radius: var(--border-radius-md, 10px);
        padding: 0 12px;
        background: var(--color-background-primary, #17181c);
        color: var(--color-text-primary, #f6f7f9);
        cursor: pointer;
        font: inherit;
        font-size: 12px;
        text-decoration: none;
      }
      button.primary, a.button.primary { border-color: transparent; background: #7c5cff; color: white; }
      button:disabled { cursor: default; opacity: .55; }
      .stage { position: relative; aspect-ratio: 16 / 9; background: #090a0c; }
      video { display: block; width: 100%; height: 100%; object-fit: contain; background: #090a0c; }
      .empty, .error { display: grid; place-items: center; height: 100%; min-height: 180px; padding: 24px; text-align: center; }
      .empty { color: var(--color-text-secondary, #a7abb5); }
      .error { color: #ff9b9b; }
      .progress { padding: 14px; }
      .progress-row { display: flex; justify-content: space-between; gap: 12px; color: var(--color-text-secondary, #a7abb5); font-size: 12px; }
      .track { height: 6px; margin-top: 10px; overflow: hidden; border-radius: 99px; background: rgba(127, 127, 127, .2); }
      .bar { height: 100%; width: 0; border-radius: inherit; background: #7c5cff; transition: width .25s ease; }
      .footer { display: flex; flex-wrap: wrap; gap: 8px 14px; padding: 10px 14px 12px; color: var(--color-text-secondary, #a7abb5); font-size: 11px; }
      @media (max-width: 520px) {
        .header { align-items: flex-start; flex-direction: column; }
        .actions { width: 100%; justify-content: flex-start; }
      }
    </style>
  </head>
  <body>
    <main id="app">
      <section class="shell">
        <header class="header">
          <div class="title">
            <strong>Neonix preview</strong>
            <span id="status">Preparing preview…</span>
          </div>
          <nav class="actions" aria-label="Video actions">
            <button id="editor" type="button">Open editor</button>
            <button id="export" class="primary" type="button" disabled>Export</button>
            <button id="fullscreen" type="button" hidden>Fullscreen</button>
          </nav>
        </header>
        <div id="stage" class="stage">
          <div class="empty">Waiting for Neonix render…</div>
        </div>
        <div id="progress" class="progress" hidden>
          <div class="progress-row"><span id="stage-label">Rendering</span><span id="percent">0%</span></div>
          <div class="track"><div id="bar" class="bar"></div></div>
        </div>
        <footer id="footer" class="footer" hidden></footer>
      </section>
    </main>
    <script>
      (() => {
        const app = document.getElementById("app");
        const stage = document.getElementById("stage");
        const statusEl = document.getElementById("status");
        const progressEl = document.getElementById("progress");
        const stageLabel = document.getElementById("stage-label");
        const percentEl = document.getElementById("percent");
        const bar = document.getElementById("bar");
        const footer = document.getElementById("footer");
        const editorButton = document.getElementById("editor");
        const exportButton = document.getElementById("export");
        const fullscreenButton = document.getElementById("fullscreen");
        const pending = new Map();
        let requestId = 1;
        let hostContext = {};
        let toolInput = {};
        let latest = null;
        let polling = false;
        let playbackLoaded = false;

        function send(method, params) {
          const id = requestId++;
          window.parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*");
          return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
        }

        function structured(result) {
          if (result && result.structuredContent) return result.structuredContent;
          if (result && result.isError) throw new Error("MCP tool call failed");
          const text = result?.content?.find?.((item) => item.type === "text")?.text;
          if (!text) return result;
          try { return JSON.parse(text); } catch { return result; }
        }

        function setStatus(text) { statusEl.textContent = text; }

        function showError(message) {
          stage.innerHTML = "";
          const error = document.createElement("div");
          error.className = "error";
          error.textContent = message;
          stage.append(error);
          progressEl.hidden = true;
          setStatus("Preview unavailable");
        }

        function openLink(url) {
          if (!url) return;
          send("ui/open-link", { url }).catch(() => window.open(url, "_blank", "noopener,noreferrer"));
        }

        function updateFooter(exportData) {
          const metrics = exportData?.metrics || {};
          const items = [];
          if (metrics.width && metrics.height) items.push(metrics.width + "×" + metrics.height);
          if (metrics.durationSeconds) items.push(Number(metrics.durationSeconds).toFixed(1) + "s");
          if (exportData?.jobId) items.push(exportData.jobId);
          footer.textContent = items.join("  ·  ");
          footer.hidden = items.length === 0;
        }

        function renderVideo(media) {
          if (!media?.url || playbackLoaded) return;
          playbackLoaded = true;
          stage.innerHTML = "";
          const video = document.createElement("video");
          video.controls = true;
          video.playsInline = true;
          video.preload = "metadata";
          video.src = media.url;
          if (media.posterUrl) video.poster = media.posterUrl;
          video.addEventListener("error", () => setStatus("Video could not be loaded"));
          stage.append(video);
          fullscreenButton.hidden = false;
          fullscreenButton.onclick = () => {
            const available = hostContext.availableDisplayModes || [];
            if (available.includes("fullscreen")) {
              const mode = hostContext.displayMode === "fullscreen" ? "inline" : "fullscreen";
              send("ui/request-display-mode", { mode }).catch(() => {});
            } else if (stage.requestFullscreen) {
              stage.requestFullscreen().catch(() => {});
            }
          };
        }

        async function loadPlayback(jobId) {
          try {
            const result = structured(await send("tools/call", { name: "get_export_download_url", arguments: { job_id: jobId } }));
            renderVideo({ url: result.url });
            exportButton.disabled = false;
            exportButton.textContent = "Download";
            exportButton.onclick = () => openLink(result.url);
          } catch (error) {
            showError(error instanceof Error ? error.message : "Could not load video");
          }
        }

        function renderExport(exportData) {
          latest = exportData;
          const status = exportData?.status || "queued";
          const progress = Math.max(0, Math.min(100, Number(exportData?.progress || 0)));
          updateFooter(exportData);
          if (status === "done") {
            setStatus("Video ready");
            progressEl.hidden = true;
            exportButton.disabled = false;
            exportButton.textContent = "Download";
            if (exportData.jobId) void loadPlayback(exportData.jobId);
            return;
          }
          if (status === "failed" || status === "cancelled") {
            setStatus(status === "failed" ? "Render failed" : "Render cancelled");
            exportButton.disabled = false;
            exportButton.textContent = "Retry export";
            exportButton.onclick = () => void startExport(true);
            showError(exportData.error || "Neonix could not finish this export.");
            return;
          }
          setStatus("Rendering video…");
          progressEl.hidden = false;
          stageLabel.textContent = exportData?.stage || "Rendering";
          percentEl.textContent = progress + "%";
          bar.style.width = progress + "%";
          exportButton.disabled = true;
          exportButton.textContent = "Exporting…";
        }

        async function poll(jobId) {
          if (polling || !jobId) return;
          polling = true;
          let delay = 2500;
          try {
            for (;;) {
              const result = structured(await send("tools/call", { name: "get_export", arguments: { job_id: jobId } }));
              const exportData = result?.export || result;
              renderExport(exportData);
              if (["done", "failed", "cancelled"].includes(exportData?.status)) break;
              await new Promise((resolve) => setTimeout(resolve, delay));
              delay = Math.min(delay * 1.25, 8000);
            }
          } catch (error) {
            showError(error instanceof Error ? error.message : "Could not read render status");
          } finally {
            polling = false;
          }
        }

        async function startExport(retry) {
          try {
            exportButton.disabled = true;
            setStatus("Starting export…");
            const args = { ...toolInput };
            if (retry) args.idempotency_key = (args.idempotency_key || "neonix-preview") + "-" + Date.now();
            const result = structured(await send("tools/call", { name: "create_export", arguments: args }));
            const exportData = result?.export || result;
            renderExport(exportData);
            if (exportData?.jobId) void poll(exportData.jobId);
          } catch (error) {
            exportButton.disabled = false;
            showError(error instanceof Error ? error.message : "Could not start export");
          }
        }

        editorButton.onclick = async () => {
          try {
            const projectId = latest?.projectId || toolInput.project_id;
            const publicRef = toolInput.public_ref;
            const args = projectId ? { project_id: projectId } : { public_ref: publicRef };
            const result = structured(await send("tools/call", { name: "open_editor", arguments: args }));
            openLink(result?.editor_url || result?.editorUrl);
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "Could not open editor");
          }
        };

        exportButton.onclick = () => void startExport(false);

        window.addEventListener("message", (event) => {
          if (event.source !== window.parent) return;
          const message = event.data;
          if (!message || message.jsonrpc !== "2.0") return;
          if (message.id !== undefined && pending.has(message.id)) {
            const request = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) request.reject(new Error(message.error.message || "Host request failed"));
            else request.resolve(message.result);
            return;
          }
          if (message.method === "ui/notifications/tool-input") {
            toolInput = message.params?.arguments || {};
          }
          if (message.method === "ui/notifications/tool-result") {
            try {
              const result = structured(message.params || {});
              const exportData = result?.export || result;
              renderExport(exportData);
              if (exportData?.jobId && exportData.status !== "done") void poll(exportData.jobId);
              else if (exportData?.jobId && exportData.status === "done") void loadPlayback(exportData.jobId);
            } catch (error) {
              showError(error instanceof Error ? error.message : "Invalid Neonix export result");
            }
          }
          if (message.method === "ui/notifications/host-context-changed") {
            hostContext = { ...hostContext, ...(message.params || {}) };
            app.classList.toggle("fullscreen", hostContext.displayMode === "fullscreen");
          }
        });

        send("ui/initialize", {
          protocolVersion: "2026-01-26",
          appInfo: { name: "Neonix Video Preview", version: "1.0.0" },
          appCapabilities: { availableDisplayModes: ["inline", "fullscreen"] }
        }).then((result) => {
          hostContext = result?.hostContext || {};
          app.classList.toggle("fullscreen", hostContext.displayMode === "fullscreen");
          send("ui/notifications/initialized", {}).catch(() => {});
        }).catch(() => {
          setStatus("Preview UI loaded in compatibility mode");
        });
      })();
    </script>
  </body>
</html>`;
