"use client";

import { AppLink } from "@/components/AppLink";
import { useEditorSurface } from "@/components/editor/EditorSurfaceProvider";
import { ShapesDropdown, type ShapeTool } from "./shapes/ShapesDropdown";
import { TextDropdown } from "./text/TextDropdown";
import { cn } from "@/lib/utils";
import { ChevronDown, Home, Scaling, Upload, User } from "lucide-react";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

const menuBtn =
  "inline-flex h-8 items-center gap-1 rounded-lg border-0 bg-transparent px-2 text-[13px] font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]";
const iconBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-transparent text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]";

/** Existing header chrome, decoupled from the former V1 store. */
export function EditorHeader() {
  const {
    document,
    currentTime,
    applyCommand,
    setSelectedLayerIds,
  } = useEditorSurface();
  const meta = `${document.id} · Protocol V2 · ${document.composition.width}×${document.composition.height}`;

  const addShape = (shape: ShapeTool) => {
    if (shape === "path") return;
    const width = 640;
    const height = 360;
    const order =
      Math.max(
        -1,
        ...document.layers
          .filter((layer) => layer.parentLayerId === null)
          .map((layer) => layer.order),
      ) + 1;
    const idBase = `shape-${shape}`;
    let id = idBase;
    let suffix = 1;
    while (document.layers.some((layer) => layer.id === id)) {
      id = `${idBase}-${suffix}`;
      suffix += 1;
    }

    const layer: MotionProtocolV2["layers"][number] = {
      id,
      type: "shape",
      parentLayerId: null,
      order,
      frame: { width, height },
      transform: {
        translate: {
          x: (document.composition.width - width) / 2,
          y: (document.composition.height - height) / 2,
          z: 0,
        },
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 0, y: 0, z: 0 },
        skew: { x: 0, y: 0 },
        anchor: { x: width / 2, y: height / 2, z: 0 },
      },
      opacity: 1,
      timing: { start: currentTime, duration: 5 },
      payload: { shape },
      style: {
        fill: "#8b8f98",
      },
    };

    if (applyCommand({ type: "add-layer", layer })) {
      setSelectedLayerIds([id]);
    }
  };

  return (
    <header className="editor-panel flex h-[var(--editor-chrome-h)] items-center gap-1.5 px-2.5 [grid-area:header]">
      <div className="flex shrink-0 items-center gap-0.5">
        <AppLink href="/" aria-label="Về workspace" className={cn(iconBtn, "no-underline")}>
          <Home size={16} strokeWidth={1.75} />
        </AppLink>
        <button type="button" className={menuBtn} title="Tệp">
          Tệp <ChevronDown size={12} className="opacity-70" />
        </button>
        <span className="mx-1 h-5 w-px bg-[var(--border-strong)]" aria-hidden />
        <ShapesDropdown onSelect={addShape} />
        <TextDropdown />
        <button type="button" className={menuBtn} title="Đổi cỡ composition">
          <Scaling size={14} strokeWidth={1.75} /> Đổi cỡ
        </button>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center px-4">
        <p
          className="max-w-full truncate text-center text-[13px] font-semibold tracking-tight text-[var(--fg-primary)]"
          style={{ fontFamily: "var(--font-display)" }}
          title={meta}
        >
          {document.id}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" aria-label="Tài khoản" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--fg-muted)]">
          <User size={14} strokeWidth={1.75} />
        </button>
        <button type="button" disabled className="inline-flex h-8 cursor-not-allowed items-center gap-1 rounded-full border-0 bg-[var(--accent)] px-3 text-[12px] font-semibold text-[var(--accent-on)] opacity-60" title="Export sẽ được nối vào render contract V2">
          <Upload size={14} strokeWidth={2} /> Export
        </button>
      </div>
    </header>
  );
}
