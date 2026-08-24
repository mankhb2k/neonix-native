"use client";

import { useEditorSurface } from "@/components/editor/EditorSurfaceProvider";
import { useLibraryPointerGesture } from "@/hooks/editor/use-library-pointer-gesture";
import { updateKeyboardSelection } from "@/lib/editor/selection/keyboard-selection";
import { Button, Panel, Tabs } from "@/components/ui";
import type { MotionProtocolV2, V2Asset } from "@motionvideo/motion-protocol/v2";
import { File as FileIcon, FileAudio, FileVideo, Image as ImageIcon, Upload } from "lucide-react";
import { useMemo, useRef, type ChangeEvent } from "react";

type V2Layer = MotionProtocolV2["layers"][number];
type DisplayLayer = { layer: V2Layer; depth: number };

function buildLayerTree(layers: readonly V2Layer[]): DisplayLayer[] {
  const children = new Map<string | null, V2Layer[]>();
  for (const layer of layers) {
    const list = children.get(layer.parentLayerId) ?? [];
    list.push(layer);
    children.set(layer.parentLayerId, list);
  }
  for (const list of children.values()) list.sort((left, right) => right.order - left.order);
  const result: DisplayLayer[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const layer of children.get(parentId) ?? []) {
      result.push({ layer, depth });
      if (layer.type === "group") visit(layer.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}

function layerKindLabel(layer: V2Layer): string {
  if (layer.type === "text") return "Text";
  if (layer.type === "shape") return layer.payload.shape;
  return layer.type;
}

function assetLabel(asset: V2Asset): string {
  return asset.id;
}

function AssetIcon({ asset }: { asset: V2Asset }) {
  if (asset.kind === "audio") return <FileAudio size={16} strokeWidth={1.7} />;
  if (asset.kind === "video") return <FileVideo size={16} strokeWidth={1.7} />;
  if (asset.kind === "image") return <ImageIcon size={16} strokeWidth={1.7} />;
  return <FileIcon size={16} strokeWidth={1.7} />;
}

function AssetItem({ asset }: { asset: V2Asset }) {
  const { onPointerDown, onKeyDown } = useLibraryPointerGesture({
    kind: "asset",
    id: asset.id,
    label: assetLabel(asset),
    asset,
    duration: asset.kind === "video" || asset.kind === "audio" ? asset.duration : undefined,
  });
  const preview = asset.kind === "image" || asset.kind === "video";
  return (
    <li>
      <button type="button" className="flex w-full items-center gap-2 rounded-md bg-[var(--bg-surface)] p-2 text-left transition-colors hover:bg-[var(--bg-hover)]" onPointerDown={onPointerDown} onKeyDown={onKeyDown} title="Kéo vào stage hoặc timeline để thêm clip">
        {preview ? (
          <span className="h-10 w-14 shrink-0 overflow-hidden rounded border border-[var(--border-subtle)] bg-black/20">
            {asset.kind === "image" ? <img src={asset.uri} alt="" className="h-full w-full object-cover" /> : <video src={asset.uri} muted preload="metadata" className="h-full w-full object-cover" />}
          </span>
        ) : (
          <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] text-[var(--fg-muted)]"><AssetIcon asset={asset} /></span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block break-all text-[12px] font-medium text-[var(--fg-primary)]">{assetLabel(asset)}</span>
        </span>
      </button>
    </li>
  );
}

function fileToAsset(file: globalThis.File, index: number): Promise<V2Asset | null> {
  const uri = URL.createObjectURL(file);
  const base = file.name || `asset-${index}`;
  if (file.type.startsWith("image/")) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ id: base, kind: "image", uri, mimeType: file.type || "image/*", width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
      image.onerror = () => resolve({ id: base, kind: "image", uri, mimeType: file.type || "image/*" });
      image.src = uri;
    });
  }
  if (file.type.startsWith("video/")) {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.onloadedmetadata = () => resolve({ id: base, kind: "video", uri, mimeType: file.type || "video/*", duration: Number.isFinite(video.duration) ? video.duration : undefined, width: video.videoWidth || undefined, height: video.videoHeight || undefined });
      video.onerror = () => resolve({ id: base, kind: "video", uri, mimeType: file.type || "video/*" });
      video.src = uri;
    });
  }
  if (file.type.startsWith("audio/")) {
    return new Promise((resolve) => {
      const audio = document.createElement("audio");
      audio.onloadedmetadata = () => resolve({ id: base, kind: "audio", uri, mimeType: file.type || "audio/*", duration: Number.isFinite(audio.duration) ? audio.duration : undefined });
      audio.onerror = () => resolve({ id: base, kind: "audio", uri, mimeType: file.type || "audio/*" });
      audio.src = uri;
    });
  }
  URL.revokeObjectURL(uri);
  return Promise.resolve(null);
}

export function Sidebar() {
  const { document, selectedLayerIds, setSelectedLayerIds, applyCommands } = useEditorSurface();
  const uploadRef = useRef<HTMLInputElement>(null);
  const displayLayers = useMemo(() => buildLayerTree(document.layers), [document.layers]);

  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    const assets = (await Promise.all(files.map(fileToAsset))).filter((asset): asset is V2Asset => asset !== null);
    const used = new Set(document.assets.map((asset) => asset.id));
    const unique = assets.map((asset) => {
      let id = asset.id;
      let suffix = 2;
      while (used.has(id)) {
        id = `${asset.id} (${suffix})`;
        suffix += 1;
      }
      used.add(id);
      return id === asset.id ? asset : { ...asset, id };
    });
    if (unique.length > 0) applyCommands(unique.map((asset) => ({ type: "add-asset", asset })));
    event.target.value = "";
  };

  return (
    <aside className="editor-panel overflow-hidden [grid-area:sidebar]">
      <Panel bodyClassName="!p-0" className="h-full rounded-none border-0 bg-transparent shadow-none">
        <Tabs defaultValue="layers" items={[
          {
            id: "layers", label: "Layers", content: (
              <div className="h-full overflow-auto p-2" data-testid="layers-panel">
                <div className="mb-2 flex items-center justify-between px-1 text-[10px] uppercase tracking-[0.08em] text-[var(--fg-muted)]"><span>Protocol V2</span><span>{displayLayers.length}</span></div>
                <ul className="space-y-1">{displayLayers.map(({ layer, depth }) => {
                  const selected = selectedLayerIds.includes(layer.id);
                  return <li key={layer.id}><button type="button" onClick={(event) => setSelectedLayerIds((previous) => updateKeyboardSelection(displayLayers.map((entry) => entry.layer.id), previous, layer.id, { shiftKey: event.shiftKey, additiveKey: event.metaKey || event.ctrlKey }))} className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors ${selected ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--fg-primary)] hover:bg-[var(--bg-hover)]"}`} style={{ paddingLeft: `${10 + depth * 14}px` }} data-layer-id={layer.id} data-layer-order={layer.order}><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium">{layer.id}</span><span className="mt-0.5 block truncate text-[10px] opacity-70">{layerKindLabel(layer)} · {layer.timing.start.toFixed(2)}s–{(layer.timing.start + layer.timing.duration).toFixed(2)}s</span></span><span className="shrink-0 font-mono text-[10px] opacity-70">z{layer.order}</span></button></li>;
                })}</ul>
              </div>
            ),
          },
          {
            id: "assets", label: "Assets", content: (
              <div className="flex h-full min-h-0 flex-col overflow-auto p-3" data-testid="assets-panel">
                <input ref={uploadRef} type="file" accept="image/*,video/*,audio/*" multiple className="hidden" onChange={onUpload} />
                <Button type="button" variant="outline" size="sm" className="mb-3 h-8 w-full cursor-default text-[12px] text-[var(--fg-secondary)]" onClick={() => uploadRef.current?.click()} data-testid="asset-upload-button"><Upload size={14} strokeWidth={1.8} /> Upload asset</Button>
                {document.assets.length === 0 ? <div className="rounded-md border border-dashed border-[var(--border-subtle)] px-3 py-6 text-center text-[12px] text-[var(--fg-muted)]">Chưa có asset.</div> : <ul className="space-y-1.5">{document.assets.map((asset) => <AssetItem key={asset.id} asset={asset} />)}</ul>}
              </div>
            ),
          },
          { id: "json", label: "JSON", content: <pre className="h-full overflow-auto p-3 text-[11px] leading-relaxed text-[var(--fg-secondary)]">{JSON.stringify(document, null, 2)}</pre> },
        ]} />
      </Panel>
    </aside>
  );
}
