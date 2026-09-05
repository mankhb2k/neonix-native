"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PreviewStage } from "@/components/docs/PreviewStage";
import {
  HTML_COMPILER_PHASE0_CASES,
  HTML_COMPILER_PHASE1_1_CASES,
  HTML_COMPILER_PHASE1_2_CASES,
  HTML_COMPILER_PHASE1_3_CASES,
  HTML_COMPILER_PHASE1_4_CASES,
  HTML_COMPILER_PAINT_PHASE2_0_CASES,
  HTML_COMPILER_PAINT_PHASE2_1_CASES,
  HTML_COMPILER_PAINT_PHASE2_2_CASES,
  HTML_COMPILER_PAINT_PHASE2_3_CASES,
  HTML_COMPILER_PAINT_PHASE2_4_CASES,
  HTML_COMPILER_PAINT_PHASE2_5_CASES,
  HTML_COMPILER_PAINT_PHASE2_6_CASES,
  HTML_COMPILER_PREVIEW_FONT_ASSETS,
  htmlCompilerPreviewCaseById,
  htmlCompilerPreviewGroups,
} from "@/lib/docs/html-compiler-preview";
import { compileHtmlCss, type HtmlCssSource } from "@motionvideo/html-compiler";

export function HtmlCompilerRuntimeLab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const browserStageRef = useRef<HTMLDivElement>(null);
  const [browserScale, setBrowserScale] = useState(0.4);
  const selected = htmlCompilerPreviewCaseById(searchParams.get("case"));
  const groups = useMemo(() => htmlCompilerPreviewGroups(), []);
  const compilation = useMemo(
    () =>
      compileHtmlCss(selected.source, {
        fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS,
      }),
    [selected.source],
  );
  const sourceDocument = useMemo(
    () => htmlCssSrcDoc(selected.source, HTML_COMPILER_PREVIEW_FONT_ASSETS),
    [selected.source],
  );

  useLayoutEffect(() => {
    const stage = browserStageRef.current;
    if (!stage) return undefined;
    const updateScale = () => {
      const rect = stage.getBoundingClientRect();
      const nextScale = Math.min(
        rect.width / selected.source.composition.width,
        rect.height / selected.source.composition.height,
      );
      if (Number.isFinite(nextScale) && nextScale > 0)
        setBrowserScale(nextScale);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [selected.source]);

  function selectCase(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("case", id);
    router.replace(`/docs/preview/html-compiler?${params.toString()}`, {
      scroll: false,
    });
  }

  return (
    <>
      <aside
        className="fixed top-16 bottom-0 left-0 z-20 flex min-h-0 w-[250px] flex-col overflow-y-auto border-r border-white/10 bg-[#0c1118]"
        data-testid="html-compiler-sidebar"
      >
        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">HTML compiler</h2>
            <span className="rounded bg-cyan-400/10 px-2 py-1 font-mono text-[10px] text-cyan-200">
              {HTML_COMPILER_PHASE0_CASES.length + HTML_COMPILER_PAINT_PHASE2_0_CASES.length + HTML_COMPILER_PAINT_PHASE2_1_CASES.length + HTML_COMPILER_PAINT_PHASE2_2_CASES.length + HTML_COMPILER_PAINT_PHASE2_3_CASES.length + HTML_COMPILER_PAINT_PHASE2_4_CASES.length + HTML_COMPILER_PAINT_PHASE2_5_CASES.length + HTML_COMPILER_PAINT_PHASE2_6_CASES.length + HTML_COMPILER_PHASE1_1_CASES.length + HTML_COMPILER_PHASE1_2_CASES.length + HTML_COMPILER_PHASE1_3_CASES.length + HTML_COMPILER_PHASE1_4_CASES.length}{" "}
              {HTML_COMPILER_PHASE0_CASES.length + HTML_COMPILER_PAINT_PHASE2_0_CASES.length + HTML_COMPILER_PAINT_PHASE2_1_CASES.length + HTML_COMPILER_PAINT_PHASE2_2_CASES.length + HTML_COMPILER_PAINT_PHASE2_3_CASES.length + HTML_COMPILER_PAINT_PHASE2_4_CASES.length + HTML_COMPILER_PAINT_PHASE2_5_CASES.length + HTML_COMPILER_PAINT_PHASE2_6_CASES.length + HTML_COMPILER_PHASE1_1_CASES.length + HTML_COMPILER_PHASE1_2_CASES.length + HTML_COMPILER_PHASE1_3_CASES.length + HTML_COMPILER_PHASE1_4_CASES.length === 1 ? "case" : "cases"}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Live fixtures for HTML → JSON V2 value normalization.
          </p>
        </div>

        <nav className="space-y-4 p-3" aria-label="HTML compiler fixtures">
          {groups.map((group) => (
            <section key={`${group.phase}-${group.topic}`} aria-label={`${group.phase} ${group.topic}`}>
              <div className="mb-1 flex items-center gap-2 px-1">
                <span className="font-mono text-[10px] text-cyan-300/80">
                  {group.phase}
                </span>
                <p className="text-[10px] font-semibold tracking-[.12em] text-slate-500 uppercase">
                  {group.topic}
                </p>
              </div>
              <ul className="space-y-1">
                {group.cases.map((item) => {
                  const active = item.id === selected.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => selectCase(item.id)}
                        aria-current={active ? "page" : undefined}
                        className={
                          active
                            ? "w-full rounded-md border border-cyan-300/20 bg-cyan-400/10 px-2 py-2 text-left text-[12px] text-cyan-100"
                            : "w-full rounded-md px-2 py-2 text-left text-[12px] text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }
                      >
                        <span className="block font-medium">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
      </aside>

      <main
        className="ml-[250px] min-h-[calc(100vh-4rem)] bg-[#07080c] px-4 py-6 text-slate-100"
        data-testid="html-compiler-runtime-lab"
      >
        <header className="mb-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[.18em] text-cyan-300 uppercase">
            <span>Preview / HTML compiler</span>
            <span className="text-slate-600">/</span>
            <span>
              {selected.phase} · {selected.topic}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold">{selected.label}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            {selected.hint}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.properties.map((property) => (
              <span
                key={property}
                className="rounded border border-white/10 bg-white/[.03] px-2 py-1 font-mono text-[10px] text-slate-400"
              >
                {property}
              </span>
            ))}
          </div>
          <div
            className="mt-3 inline-flex rounded border border-cyan-300/20 bg-cyan-400/5 px-2 py-1 font-mono text-[10px] text-cyan-200"
            data-testid="html-compiler-composition"
          >
            Composition {selected.source.composition.width}x
            {selected.source.composition.height} ·{" "}
            {selected.source.composition.fps} fps ·{" "}
            {selected.source.composition.background} ·{" "}
            {selected.source.composition.colorSpace}
          </div>
        </header>

        <div
          className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2"
          data-testid="html-compiler-two-panel"
        >
          <Panel title="Browser CSS reference" badge="Native HTML / CSS">
            <div
              ref={browserStageRef}
              className="relative aspect-video overflow-hidden bg-[#081018]"
              data-testid="html-compiler-browser-stage"
            >
              <iframe
                title={`Native browser HTML CSS reference: ${selected.label}`}
                className="absolute left-0 top-0 border-0"
                style={{
                  width: `${selected.source.composition.width}px`,
                  height: `${selected.source.composition.height}px`,
                  transform: `scale(${browserScale})`,
                  transformOrigin: "top left",
                }}
                // Keep scripts disabled, but retain the parent origin so local
                // catalog fonts are allowed to load in the browser reference.
                sandbox="allow-same-origin"
                srcDoc={sourceDocument}
              />
            </div>
          </Panel>

          <Panel title="Compiler output" badge="HTML/CSS → JSON V2 → Skia">
            {compilation.protocol ? (
              <div
                className="aspect-video overflow-hidden bg-[#101820]"
                data-testid="html-compiler-runtime-stage"
              >
                <PreviewStage
                  key={selected.id}
                  project={compilation.protocol}
                  backend="skia"
                  time={0}
                  testId="html-compiler-runtime-canvas"
                />
              </div>
            ) : (
              <DiagnosticStage diagnostics={compilation.diagnostics} />
            )}
          </Panel>
        </div>

        <section className="mt-5 grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
          <SourceCanvas source={selected.source} />
          <SourcePanel
            title="Normalized Protocol V2"
            value={JSON.stringify(
              compilation.protocol ?? { diagnostics: compilation.diagnostics },
              null,
              2,
            )}
          />
        </section>
      </main>
    </>
  );
}

function Panel({
  title,
  badge,
  children,
}: {
  title: string;
  badge: string;
  children: ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1118]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="rounded bg-cyan-400/10 px-2 py-1 font-mono text-[10px] text-cyan-200">
          {badge}
        </span>
      </div>
      {children}
    </article>
  );
}

function SourcePanel({ title, value }: { title: string; value: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1118]">
      <div className="border-b border-white/10 px-4 py-3 text-[11px] font-semibold tracking-[.14em] text-cyan-300/80 uppercase">
        {title}
      </div>
      <pre className="max-h-[320px] overflow-auto p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-400">
        {value}
      </pre>
    </section>
  );
}

type SourceCanvasTab = "composition" | "html" | "css";

function SourceCanvas({ source }: { source: HtmlCssSource }) {
  const [tab, setTab] = useState<SourceCanvasTab>("html");
  const tabs: Array<{ id: SourceCanvasTab; label: string; value: string }> = [
    {
      id: "composition",
      label: "Composition",
      value: JSON.stringify(source.composition, null, 2),
    },
    { id: "html", label: "HTML", value: source.html },
    { id: "css", label: "CSS", value: source.css },
  ];
  const active = tabs.find((item) => item.id === tab) ?? tabs[0];

  return (
    <section
      className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1118]"
      data-testid="html-compiler-source-canvas"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="text-[11px] font-semibold tracking-[.14em] text-cyan-300/80 uppercase">
          Source Canvas
        </div>
        <div
          className="flex items-center gap-1 rounded-md border border-white/10 bg-black/10 p-1"
          role="tablist"
          aria-label="HTML compiler source"
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === tab}
              onClick={() => setTab(item.id)}
              className={
                item.id === tab
                  ? "rounded bg-cyan-400/10 px-2 py-1 font-mono text-[10px] text-cyan-100"
                  : "rounded px-2 py-1 font-mono text-[10px] text-slate-500 hover:text-slate-300"
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <pre
        className="max-h-[320px] min-h-[220px] overflow-auto p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-400"
        role="tabpanel"
      >
        {active.value}
      </pre>
    </section>
  );
}

function DiagnosticStage({
  diagnostics,
}: {
  diagnostics: Array<{ code: string; message: string }>;
}) {
  return (
    <div
      className="flex aspect-video flex-col overflow-auto bg-[#170d13] p-5"
      data-testid="html-compiler-runtime-stage"
    >
      <p className="text-[11px] font-semibold tracking-[.14em] text-rose-300 uppercase">
        Compiler diagnostic
      </p>
      {diagnostics.map((diagnostic) => (
        <div
          key={`${diagnostic.code}-${diagnostic.message}`}
          className="mt-3 rounded border border-rose-300/20 bg-rose-950/20 p-3 text-xs text-slate-300"
        >
          <p className="font-mono text-rose-200">{diagnostic.code}</p>
          <p className="mt-1">{diagnostic.message}</p>
        </div>
      ))}
    </div>
  );
}

function htmlCssSrcDoc(
  source: HtmlCssSource,
  fontAssets: typeof HTML_COMPILER_PREVIEW_FONT_ASSETS,
): string {
  const css = source.css.replace(/<\/style/gi, "<\\/style");
  const html = source.html.replace(/<\/style/gi, "<\\/style");
  const { width, height, background } = source.composition;
  const cssFamilies = source.css.toLocaleLowerCase();
  const fontFaces = fontAssets
    .filter((asset) => cssFamilies.includes(asset.family.toLocaleLowerCase()))
    .map(
      (asset) =>
        `@font-face { font-family: "${asset.family}"; src: url("${asset.uri}") format("truetype"); font-style: ${asset.style}; font-stretch: ${asset.stretch ?? "normal"}; font-weight: ${asset.weight}; }`,
    )
    .join("\n");
  const injectedStyles = `<meta charset="utf-8"><style>${fontFaces}\n${css}</style><style>html, body { width: ${width}px; height: ${height}px; margin: 0; overflow: hidden; background: ${background}; }</style>`;
  if (/<html(?:\s|>)/i.test(html))
    return html.replace(/<head([^>]*)>/i, `<head$1>${injectedStyles}`);
  return `<!DOCTYPE html><html><head>${injectedStyles}</head><body>${html}</body></html>`;
}
