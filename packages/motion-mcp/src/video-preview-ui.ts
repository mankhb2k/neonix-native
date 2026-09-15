/**
 * Small, dependency-free MCP Apps badge for a Neonix export.
 *
 * The badge keeps the chat surface light: it never embeds the video player
 * or the editor. It only exposes the project metadata and signed links.
 */
export const VIDEO_PREVIEW_RESOURCE_URI = "ui://neonix/video-preview/v1.html";
export const MCP_APP_RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";

export const VIDEO_PREVIEW_UI_HTML = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Neonix export</title>
    <style>
      :root {
        color-scheme: light;
        font-family: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
        color: #171717;
      }
      * { box-sizing: border-box; }
      html, body { overflow: hidden; }
      body { margin: 0; background: transparent; }
      #app { width: 100%; max-width: 900px; margin: 0 auto; }
      .badge {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        color: var(--fg-primary, #171717);
      }
      .project { min-width: 0; flex: 1; }
      .project-name {
        display: block;
        overflow: hidden;
        font-size: 13px;
        font-weight: 600;
        line-height: 18px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .meta {
        display: flex;
        align-items: center;
        gap: 8px;
        overflow: hidden;
        color: var(--fg-muted, #919191);
        font-size: 11px;
        white-space: nowrap;
      }
      .meta span { overflow: hidden; text-overflow: ellipsis; }
      .meta .status { color: var(--accent-text, #0f766e); }
      .meta .status.error { color: #be123c; }
      .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
      button {
        min-height: 32px;
        border: 1px solid var(--border-strong, #cecece);
        border-radius: 8px;
        padding: 0 12px;
        background: var(--bg-elevated, #ffffff);
        color: var(--fg-primary, #171717);
        cursor: pointer;
        font: inherit;
        font-size: 12px;
      }
      button:hover:not(:disabled) { border-color: var(--border-focus, #0d9488); }
      button.primary { border-color: transparent; background: var(--accent, #0d9488); color: var(--accent-on, #fafafa); }
      button.primary:hover:not(:disabled) { background: var(--accent-hover, #0f766e); }
      button:disabled { cursor: default; opacity: .55; }
      @media (max-width: 520px) {
        .badge { align-items: flex-start; flex-direction: column; }
        .actions { width: 100%; justify-content: flex-start; }
      }
    </style>
  </head>
  <body>
    <section id="app" class="badge" role="status" aria-live="polite">
      <div class="project">
        <strong id="project-name" class="project-name">New Neonix project</strong>
        <div class="meta">
          <span id="duration">—</span>
          <span aria-hidden="true">·</span>
          <span id="status" class="status">Preparing...</span>
        </div>
      </div>
      <nav class="actions" aria-label="Video actions">
        <button id="preview" type="button" disabled>Open Preview</button>
        <button id="editor" type="button">Open editor (BETA)</button>
        <button id="export" class="primary" type="button" disabled>Export</button>
      </nav>
    </section>
    <script>
      (() => {
        const app = document.getElementById("app");
        const projectNameEl = document.getElementById("project-name");
        const durationEl = document.getElementById("duration");
        const statusEl = document.getElementById("status");
        const previewButton = document.getElementById("preview");
        const editorButton = document.getElementById("editor");
        const exportButton = document.getElementById("export");
        const pending = new Map();
        let requestId = 1;
        let toolInput = {};
        let latest = null;
        let polling = false;

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

        function setStatus(text, error) {
          statusEl.textContent = text;
          statusEl.classList.toggle("error", Boolean(error));
        }

        function setProjectMetadata(data) {
          const metrics = data?.metrics || {};
          const name = data?.projectName || data?.project_name || data?.name
            || data?.title || data?.project?.name || data?.project?.title
            || toolInput.project_name || toolInput.projectName || toolInput.name || toolInput.title;
          if (name) projectNameEl.textContent = name;
          if (metrics.durationSeconds !== undefined && metrics.durationSeconds !== null) {
            durationEl.textContent = Number(metrics.durationSeconds).toFixed(1) + "s";
          }
        }

        function projectLocator(data) {
          const project = data?.project || data || {};
          return {
            projectId: data?.projectId || data?.project_id || project.id || project.projectId,
            publicRef: data?.publicRef || data?.public_ref || project.publicRef || project.public_ref,
          };
        }

        function exportJobId(data) {
          return data?.jobId || data?.job_id;
        }

        function isExportResult(data) {
          return Boolean(data?.status || exportJobId(data) || data?.metrics || data?.progress !== undefined);
        }

        function notifyHeight() {
          const height = Math.ceil(Math.max(app.getBoundingClientRect().height, document.documentElement.scrollHeight));
          window.parent.postMessage({ type: "neonix/video-preview/resize", height }, "*");
        }

        function openLink(url) {
          if (!url) return;
          send("ui/open-link", { url }).catch(() => window.open(url, "_blank", "noopener,noreferrer"));
        }

        function disablePreviewButton() {
          previewButton.disabled = true;
          previewButton.onclick = null;
        }

        function enablePreviewButton() {
          const locator = projectLocator(latest || toolInput);
          if (!locator.projectId && !locator.publicRef) {
            disablePreviewButton();
            return;
          }
          previewButton.disabled = false;
          previewButton.onclick = () => void openPreview();
        }

        async function openPreview() {
          try {
            const locator = projectLocator(latest || toolInput);
            const args = locator.projectId
              ? { project_id: locator.projectId }
              : { public_ref: locator.publicRef };
            const result = structured(await send("tools/call", {
              name: "open_preview",
              arguments: args,
            }));
            const url = result?.preview_url || result?.previewUrl;
            if (!url) throw new Error("Preview URL is unavailable");
            openLink(url);
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "Could not open preview", true);
          }
        }

        function showError(message) {
          setStatus(message, true);
          exportButton.disabled = false;
          exportButton.textContent = "Retry export";
          exportButton.onclick = () => void startExport(true);
          notifyHeight();
        }

        async function loadDownloadUrl(jobId) {
          try {
            const result = structured(await send("tools/call", {
              name: "get_export_download_url",
              arguments: { job_id: jobId },
            }));
            const url = result?.url || result?.downloadUrl || result?.download_url;
            if (!url) throw new Error("Download URL is unavailable");
            exportButton.disabled = false;
            exportButton.textContent = "Download";
            exportButton.onclick = () => openLink(url);
          } catch (error) {
            showError(error instanceof Error ? error.message : "Could not create download link");
          }
        }

        function renderExport(exportData) {
          latest = exportData;
          setProjectMetadata(exportData);
          const status = exportData?.status || "queued";
          if (status === "done") {
            setStatus("Video ready");
            exportButton.disabled = false;
            exportButton.textContent = "Download";
            const downloadUrl = exportData.downloadUrl || exportData.download_url;
            if (downloadUrl) {
              exportButton.onclick = () => openLink(downloadUrl);
            } else if (exportJobId(exportData)) {
              void loadDownloadUrl(exportJobId(exportData));
            }
            return;
          }
          if (status === "failed" || status === "cancelled") {
            showError(exportData.error || "Neonix could not finish this export.");
            return;
          }
          setStatus("Exporting...");
          exportButton.disabled = true;
          exportButton.textContent = "Exporting...";
        }

        function renderProjectResult(projectData) {
          latest = projectData;
          setProjectMetadata(projectData);
          setStatus("Ready");
          enablePreviewButton();
          exportButton.disabled = false;
          exportButton.textContent = "Export";
          exportButton.onclick = () => void startExport(false);
        }

        async function poll(jobId) {
          if (polling || !jobId) return;
          polling = true;
          let delay = 2500;
          try {
            for (;;) {
              const result = structured(await send("tools/call", {
                name: "get_export",
                arguments: { job_id: jobId },
              }));
              const exportData = result?.export || result;
              renderExport(exportData);
              if (["done", "failed", "cancelled"].includes(exportData?.status)) break;
              await new Promise((resolve) => setTimeout(resolve, delay));
              delay = Math.min(delay * 1.25, 8000);
            }
          } catch (error) {
            showError(error instanceof Error ? error.message : "Could not read export status");
          } finally {
            polling = false;
          }
        }

        async function startExport(retry) {
          try {
            exportButton.disabled = true;
            exportButton.textContent = "Exporting...";
            setStatus("Exporting...");
            const locator = projectLocator(latest || toolInput);
            const args = {
              ...(locator.projectId ? { project_id: locator.projectId } : {}),
              ...(!locator.projectId && locator.publicRef ? { public_ref: locator.publicRef } : {}),
              ...(toolInput.protocol_revision_no ? { protocol_revision_no: toolInput.protocol_revision_no } : {}),
              ...(toolInput.preset ? { preset: toolInput.preset } : {}),
            };
            if (retry) args.idempotency_key = (args.idempotency_key || "neonix-preview") + "-" + Date.now();
            const result = structured(await send("tools/call", {
              name: "create_export",
              arguments: args,
            }));
            const exportData = result?.export || result;
            renderExport(exportData);
            if (exportJobId(exportData)) void poll(exportJobId(exportData));
          } catch (error) {
            showError(error instanceof Error ? error.message : "Could not start export");
          }
        }

        editorButton.onclick = async () => {
          try {
            const locator = projectLocator(latest || toolInput);
            const projectId = locator.projectId;
            const publicRef = locator.publicRef;
            const args = projectId ? { project_id: projectId } : { public_ref: publicRef };
            const result = structured(await send("tools/call", { name: "open_editor", arguments: args }));
            openLink(result?.editor_url || result?.editorUrl);
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "Could not open editor", true);
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
            setProjectMetadata(toolInput);
            enablePreviewButton();
            exportButton.disabled = false;
          }
          if (message.method === "ui/notifications/tool-result") {
            try {
              const result = structured(message.params || {});
              const data = result?.export || result;
              if (isExportResult(data)) {
                renderExport(data);
                if (exportJobId(data) && data.status !== "done") void poll(exportJobId(data));
              } else {
                renderProjectResult(data);
              }
            } catch (error) {
              showError(error instanceof Error ? error.message : "Invalid Neonix export result");
            }
          }
        });

        if (typeof ResizeObserver !== "undefined") {
          const resizeObserver = new ResizeObserver(notifyHeight);
          resizeObserver.observe(app);
        }
        window.setTimeout(notifyHeight, 0);

        send("ui/initialize", {
          protocolVersion: "2026-01-26",
          appInfo: { name: "Neonix Export Badge", version: "1.0.0" },
          appCapabilities: { availableDisplayModes: [] },
        }).then(() => send("ui/notifications/initialized", {})).catch(() => {
          setStatus("Ready", false);
        });
      })();
    </script>
  </body>
</html>`;
