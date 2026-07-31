"use client";

import React, { useEffect, useRef, useState, type DragEvent } from "react";
import { Plus, Pause, Play } from "lucide-react";
import { useEditorStore } from "@/lib/editor/editor-store";
import {
  clearDragCursor,
  setDragCursor,
} from "@/lib/editor/drag-cursor";
import {
  AUDIO_LIBRARY_MIME,
  normalizeAudioDurationSec,
} from "@/lib/editor/dnd/editor-drag-payload";
import {
  SidebarPanel,
  SidebarPanelHeader,
  SidebarPanelContent,
} from "../SidebarPanel/SidebarPanel";
import { Search, Button } from "@/components/ui";

/** Re-export để consumer cũ không gãy; nguồn sự thật ở lib/editor/dnd. */
export { AUDIO_LIBRARY_MIME } from "@/lib/editor/dnd/editor-drag-payload";

export const MOCK_AUDIO_ITEMS = [
  { id: "aud_1", title: "Colors Of Life", artist: "ARCStudio", duration: "02:00" },
  { id: "aud_2", title: "Piano Inspiration", artist: "Raw Vibrations", duration: "03:44" },
  { id: "aud_3", title: "Chill Coffee Groove", artist: "Gummy MusicLab", duration: "01:59" },
  { id: "aud_4", title: "Happy Moments", artist: "INCO Studio", duration: "01:52" },
  { id: "aud_5", title: "Funk Music 10506", artist: "SonicMusic", duration: "02:13" },
  { id: "aud_6", title: "Fashion Funky Dance", artist: "SoundForYou", duration: "01:31" },
  { id: "aud_7", title: "Upbeat Corporate", artist: "MotiClip Mock", duration: "01:20" },
  { id: "aud_8", title: "Soft Ambient Pad", artist: "MotiClip Mock", duration: "02:45" },
  { id: "aud_9", title: "Whoosh Transition", artist: "SFX Pack", duration: "00:03" },
];

const EMPTY_DRAG_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** WAV ngắn — preview thật bằng HTMLAudioElement khi library chưa có URI asset. */
const PREVIEW_TONE_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

function LibraryAudioPreviewButton({ itemId }: { itemId: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  function toggle() {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio(PREVIEW_TONE_WAV);
      audioRef.current.preload = "auto";
      audioRef.current.addEventListener("ended", () => setPlaying(false));
    }
    void audioRef.current.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }

  return (
    <Button
      size="xs"
      variant="ghost"
      aria-label={playing ? `Dừng ${itemId}` : `Nghe thử ${itemId}`}
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      leftIcon={playing ? <Pause size={13} /> : <Play size={13} />}
      className="shrink-0"
    >
      {playing ? "Dừng" : "Nghe"}
    </Button>
  );
}

export function AudioPanel() {
  const addAudioTrack = useEditorStore((s) => s.addAudioTrack);
  const setActiveDragItem = useEditorStore((s) => s.setActiveDragItem);
  const setIsOverTimeline = useEditorStore((s) => s.setIsOverTimeline);

  function onDragStart(
    event: DragEvent<HTMLDivElement>,
    item: (typeof MOCK_AUDIO_ITEMS)[number],
  ) {
    const img = new Image();
    img.src = EMPTY_DRAG_IMAGE;
    event.dataTransfer.setDragImage(img, 0, 0);
    const durationSec = normalizeAudioDurationSec(item.duration);
    event.dataTransfer.setData(AUDIO_LIBRARY_MIME, JSON.stringify(item));
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        id: item.id,
        type: "audio",
        name: item.title,
        duration: durationSec,
      }),
    );
    event.dataTransfer.setData("text/plain", item.title);
    event.dataTransfer.effectAllowed = "copy";
    setActiveDragItem({
      id: item.id,
      type: "audio",
      name: item.title,
      duration: durationSec,
    });
    setIsOverTimeline(false);
    if (event.clientX > 0 && event.clientY > 0) {
      setDragCursor(event.clientX, event.clientY);
    }
  }

  function onDrag(event: DragEvent<HTMLDivElement>) {
    if (event.clientX > 0 && event.clientY > 0) {
      setDragCursor(event.clientX, event.clientY);
    }
  }

  function onDragEnd() {
    setActiveDragItem(null);
    clearDragCursor();
    setIsOverTimeline(false);
  }

  return (
    <SidebarPanel>
      <SidebarPanelHeader>
        <Search placeholder="Tìm kiếm âm thanh, nhạc nền..." />
      </SidebarPanelHeader>

      <SidebarPanelContent>
        <div className="flex flex-col gap-2 min-w-0">
          {MOCK_AUDIO_ITEMS.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(event) => onDragStart(event, item)}
              onDrag={onDrag}
              onDragEnd={onDragEnd}
              className="group flex items-center justify-between gap-3 p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-[#27272A] text-[var(--fg-secondary)] shrink-0">
                  <span className="text-[10px] font-semibold tabular-nums">
                    {item.duration}
                  </span>
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-[12px] font-medium text-[var(--fg-primary)] truncate">
                    {item.title}
                  </span>
                  <span className="text-[10px] text-[var(--fg-muted)] truncate">
                    {item.artist} · {item.duration}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <LibraryAudioPreviewButton itemId={item.id} />
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() =>
                    addAudioTrack({
                      role: item.title,
                      assetId: item.id,
                      duration: normalizeAudioDurationSec(item.duration),
                    })
                  }
                  leftIcon={<Plus size={13} />}
                  className="opacity-90 group-hover:opacity-100"
                >
                  Thêm
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SidebarPanelContent>
    </SidebarPanel>
  );
}
