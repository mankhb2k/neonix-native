"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PreviewStage } from "@/components/preview/PreviewStage";
import { SKIA_ANIMATION_CASES } from "@/lib/docs/skia-preview-fixtures";
import { VIDEO_PREVIEW_UI_HTML } from "@motionvideo/motion-mcp/video-preview-ui";
import { compileProtocol } from "@motionvideo/motion-compiler";
import { evaluateRuntimeProjectV3, frameIndexAtTime } from "@motionvideo/motion-runtime";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

type DemoState = "queued" | "rendering" | "done" | "failed";

const SAMPLE_VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const DEMO_PROJECT_ID = "00000000-0000-4000-8000-000000000001";
const DEMO_JOB_ID = "job_mcp_preview_demo";

type SkiaDemoSpec = {
  id: string;
  label: string;
  ratio: `${number} / ${number}`;
  fixtureId: string;
  description: string;
  width: number;
  height: number;
};

const SKIA_VIDEO_DEMOS: readonly SkiaDemoSpec[] = [
  {
    id: "skia-demo-landscape",
    label: "Landscape",
    ratio: "16 / 9",
    fixtureId: "animation.transform-keyframes",
    description: "Animated transform + scale",
    width: 1920,
    height: 1080,
  },
  {
    id: "skia-demo-portrait",
    label: "Portrait",
    ratio: "9 / 16",
    fixtureId: "animation.timing-stagger",
    description: "Staggered layer timing",
    width: 1080,
    height: 1920,
  },
  {
    id: "skia-demo-square",
    label: "Square",
    ratio: "1 / 1",
    fixtureId: "animation.opacity",
    description: "Animated opacity track",
    width: 1080,
    height: 1080,
  },
];

function skiaDemoProject(spec: SkiaDemoSpec): MotionProtocolV2 {
  const fixture = SKIA_ANIMATION_CASES.find((item) => item.id === spec.fixtureId);
  if (!fixture) throw new Error(`Missing Skia demo fixture: ${spec.fixtureId}`);
  return {
    ...fixture.project,
    id: `${fixture.project.id}-${spec.width}x${spec.height}`,
    composition: {
      ...fixture.project.composition,
      width: spec.width,
      height: spec.height,
    },
  };
}

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

function SkiaVideoDemoCard({ spec }: { spec: SkiaDemoSpec }) {
  const project = useMemo(() => skiaDemoProject(spec), [spec]);
  const runtime = useMemo(() => compileProtocol(project), [project]);
  const duration = useMemo(
    () => Math.max(0.1, ...project.layers.map((layer) => (layer.timing.start + layer.timing.duration) / 1000)),
    [project],
  );
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const frame = useMemo(
    () => evaluateRuntimeProjectV3(runtime, frameIndexAtTime(time, project.composition.fps), { time }),
    [project, runtime, time],
  );

  useEffect(() => {
    if (!isPlaying) return undefined;
    let previousAt = performance.now();
    const tick = (now: number) => {
      const delta = Math.max(0, (now - previousAt) / 1000);
      previousAt = now;
      setTime((current) => {
        const next = current + delta;
        return next >= duration ? 0 : next;
      });
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };
  }, [duration, isPlaying]);

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-sm">
      <div className="relative w-full overflow-hidden bg-[#101820]" style={{ aspectRatio: spec.ratio }}>
        <PreviewStage
          project={project}
          frame={frame}
          time={time}
          isPlaying={isPlaying}
          backend="skia"
          testId={spec.id}
        />
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.08em] text-white/85">
          SKIA / {spec.ratio.replaceAll(" ", "")}
        </span>
      </div>
      <div className="space-y-3 border-t border-[var(--border-subtle)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="m-0 text-sm font-semibold text-[var(--fg-primary)]">{spec.label}</h3>
            <p className="mt-1 m-0 text-xs text-[var(--fg-muted)]">{spec.description}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsPlaying((playing) => !playing)}
            aria-label={isPlaying ? `Pause ${spec.label} preview` : `Play ${spec.label} preview`}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)] transition hover:bg-[var(--accent)] hover:text-[var(--accent-on)]"
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </button>
        </div>
        <input
          aria-label={`${spec.label} preview timeline`}
          type="range"
          min={0}
          max={duration}
          step={1 / project.composition.fps}
          value={Math.min(time, duration)}
          onChange={(event) => {
            setIsPlaying(false);
            setTime(Number(event.target.value));
          }}
          className="h-1 w-full accent-[var(--accent)]"
        />
        <div className="flex items-center justify-between font-mono text-[10px] text-[var(--fg-muted)]">
          <span>{time.toFixed(2)}s</span>
          <span>{duration.toFixed(2)}s</span>
        </div>
      </div>
    </article>
  );
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

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--accent-text)]">Skia runtime demos</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--fg-primary)]">Real-time canvas previews</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--fg-secondary)]">
              These cards render the Protocol V2 animation fixtures through the real Skia backend, with independent play/pause controls.
            </p>
          </div>
        </div>
        <div className="grid items-start gap-5 md:grid-cols-3">
          {SKIA_VIDEO_DEMOS.map((spec) => <SkiaVideoDemoCard key={spec.id} spec={spec} />)}
        </div>
      </section>
    </main>
  );
}
