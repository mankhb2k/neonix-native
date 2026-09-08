"use client";

import {
  File as FileIcon,
  FileAudio,
  FileVideo,
  Image as ImageIcon,
} from "lucide-react";
import { useLibraryPointerGesture } from "@/hooks/editor/use-library-pointer-gesture";
import type { V2Asset } from "@motionvideo/motion-protocol/v2";

export function assetLabel(asset: V2Asset): string {
  return asset.id;
}

export function AssetIcon({ asset }: { asset: V2Asset }) {
  if (asset.kind === "audio") return <FileAudio size={16} strokeWidth={1.7} />;
  if (asset.kind === "video") return <FileVideo size={16} strokeWidth={1.7} />;
  if (asset.kind === "image") return <ImageIcon size={16} strokeWidth={1.7} />;
  return <FileIcon size={16} strokeWidth={1.7} />;
}

export function AssetItem({ asset }: { asset: V2Asset }) {
  const { onPointerDown, onKeyDown } = useLibraryPointerGesture({
    kind: "asset",
    id: asset.id,
    label: assetLabel(asset),
    asset,
    duration:
      asset.kind === "video" || asset.kind === "audio"
        ? asset.duration === undefined
          ? undefined
          : asset.duration / 1000
        : undefined,
  });
  const preview = asset.kind === "image" || asset.kind === "video";

  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md bg-[var(--bg-surface)] p-2 text-left transition-colors hover:bg-[var(--bg-hover)]"
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        title="Drag to the stage or timeline to add a clip"
      >
        {preview ? (
          <span className="h-10 w-14 shrink-0 overflow-hidden rounded border border-[var(--border-subtle)] bg-black/20">
            {asset.kind === "image" ? (
              // Asset URLs can be user-provided and are not known at build time.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.uri}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <video
                crossOrigin="anonymous"
                src={asset.uri}
                muted
                preload="metadata"
                className="h-full w-full object-cover"
              />
            )}
          </span>
        ) : (
          <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] text-[var(--fg-muted)]">
            <AssetIcon asset={asset} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block break-all text-[12px] font-medium text-[var(--fg-primary)]">
            {assetLabel(asset)}
          </span>
        </span>
      </button>
    </li>
  );
}
