"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VIDEO_PREVIEW_UI_HTML } from "@motionvideo/motion-mcp/video-preview-ui";

type DemoState = "queued" | "rendering" | "done" | "failed";

const SAMPLE_VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const DEMO_PROJECT_ID = "00000000-0000-4000-8000-000000000001";
const DEMO_JOB_ID = "job_mcp_preview_demo";

function exportForState(state: DemoState) {
  return {
    jobId: DEMO_JOB_ID,
    projectId: DEMO_PROJECT_ID,
    protocolRevisionNo: 1,
    status: state,
    progress: state === "queued" ? 0 : state === "rendering" ? 64 : state === "done" ? 100 : 42,
    stage: state === "queued" ? "queued" : state === "rendering" ? "encoding" : state,
    error: state === "failed" ? "The demo render failed. Choose another state to retry." : null,
    metrics: state === "done" ? { width: 1280, height: 720, durationSeconds: 5 } : undefined,
  };
}

export function McpVideoPreviewLab() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<DemoState>("rendering");
  const [frameKey, setFrameKey] = useState(0);
  const [frameHeight, setFrameHeight] = useState(60);
  const [lastOpenedUrl, setLastOpenedUrl] = useState<string | null>(null);

  const exportData = useMemo(() => exportForState(state), [state]);

  const postToFrame = useCallback((message: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage({ jsonrpc: "2.0", ...message }, "*");
  }, []);

  const reset = useCallback((nextState: DemoState) => {
    setLastOpenedUrl(null);
    setState(nextState);
    setFrameHeight(60);
    setFrameKey((key) => key + 1);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const message = event.data;
      if (!message) return;
      if (message.type === "neonix/video-preview/resize") {
        const nextHeight = Number(message.height);
        if (Number.isFinite(nextHeight)) setFrameHeight(Math.max(52, Math.min(800, Math.ceil(nextHeight) + 2)));
        return;
      }
      if (message.jsonrpc !== "2.0") return;

      if (message.method === "ui/initialize") {
        postToFrame({
          id: message.id,
          result: {
            protocolVersion: "2026-01-26",
            hostCapabilities: {
              openLinks: {},
              serverTools: {},
            },
            hostInfo: { name: "Neonix Preview Lab", version: "0.1.0" },
            hostContext: {
              theme: "dark",
              displayMode: "inline",
              availableDisplayModes: ["inline", "fullscreen"],
              containerDimensions: { width: 760, maxHeight: 720 },
              locale: "en-US",
              platform: "web",
            },
          },
        });
        window.setTimeout(() => {
          postToFrame({
            method: "ui/notifications/tool-input",
            params: {
              arguments: {
                project_id: DEMO_PROJECT_ID,
                project_name: "Neonix preview demo",
                protocol_revision_no: 1,
                preset: "export-1080p",
              },
            },
          });
          postToFrame({
            method: "ui/notifications/tool-result",
            params: {
              content: [{ type: "text", text: JSON.stringify({ export: exportData }) }],
              structuredContent: { export: exportData },
            },
          });
        }, 0);
        return;
      }

      if (message.id === undefined) return;

      if (message.method === "tools/call") {
        const name = message.params?.name;
        if (name === "get_export") {
          postToFrame({ id: message.id, result: { structuredContent: { export: exportData } } });
          return;
        }
        if (name === "get_export_download_url") {
          postToFrame({
            id: message.id,
            result: {
              structuredContent: {
                jobId: DEMO_JOB_ID,
                url: SAMPLE_VIDEO_URL,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
              },
            },
          });
          return;
        }
        if (name === "open_editor") {
          postToFrame({
            id: message.id,
            result: {
              structuredContent: {
                project_id: DEMO_PROJECT_ID,
                public_ref: "prj_mcp_preview_demo",
                editor_url: "/app/editor?project=prj_mcp_preview_demo",
              },
            },
          });
          return;
        }
        if (name === "open_preview") {
          postToFrame({
            id: message.id,
            result: {
              structuredContent: {
                project_id: DEMO_PROJECT_ID,
                public_ref: "prj_mcp_preview_demo",
                preview_url: `/preview/${DEMO_PROJECT_ID}`,
              },
            },
          });
          return;
        }
        if (name === "create_export") {
          setState("rendering");
          postToFrame({ id: message.id, result: { structuredContent: { export: exportForState("rendering") } } });
          return;
        }
      }

      if (message.method === "ui/open-link") {
        setLastOpenedUrl(String(message.params?.url ?? ""));
        postToFrame({ id: message.id, result: {} });
        return;
      }

      if (message.method === "ui/request-display-mode") {
        const mode = message.params?.mode === "fullscreen" ? "fullscreen" : "inline";
        postToFrame({ id: message.id, result: { mode } });
        postToFrame({ method: "ui/notifications/host-context-changed", params: { displayMode: mode } });
        return;
      }

      postToFrame({ id: message.id, result: {} });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [exportData, postToFrame]);

  return (
    <main className="mx-auto max-w-[1120px] px-6 py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-text)]">MCP UI test lab</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)]">Neonix video preview</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--fg-secondary)]">
            This route embeds the exact MCP Apps HTML resource used by Claude. The surrounding page acts as a small mock host.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Preview states">
          {(["queued", "rendering", "done", "failed"] as DemoState[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => reset(item)}
              className={`rounded-full border px-3 py-1.5 text-xs capitalize transition ${
                item === state
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--fg-primary)]"
                  : "border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:border-[var(--fg-secondary)]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <section className="contents">
        <div className="hidden">
          <span>Mock host · state: {state}</span>
          <span className="font-mono">text/html;profile=mcp-app</span>
        </div>
        <div className="p-0">
          <iframe
            key={frameKey}
            ref={frameRef}
            title="Neonix MCP video preview"
            srcDoc={VIDEO_PREVIEW_UI_HTML}
            sandbox="allow-scripts"
            scrolling="no"
            style={{ height: `${frameHeight}px` }}
            className="mx-auto block w-full max-w-[900px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-editor)] shadow-[0_8px_24px_rgba(23,23,23,.07)]"
          />
        </div>
        <div className="hidden">
          <span>Mock tool calls are handled in the parent route; no Neonix data is changed.</span>
          {lastOpenedUrl ? <span className="ml-3 font-mono text-[var(--accent-text)]">open-link → {lastOpenedUrl}</span> : null}
        </div>
      </section>
    </main>
  );
}
