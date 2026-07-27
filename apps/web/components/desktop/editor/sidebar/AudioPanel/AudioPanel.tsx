"use client";

import React, { useState } from "react";
import { Music, Plus, Play, Pause } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";
import {
  SidebarPanel,
  SidebarPanelHeader,
  SidebarPanelContent,
} from "../SidebarPanel/SidebarPanel";
import { Search, Button } from "@/components/ui";

export const AUDIO_LIBRARY_MIME = "application/x-moticlip-audio";

export const MOCK_AUDIO_ITEMS = [
  { id: "aud_1", title: "Colors Of Life", artist: "ARCStudio", duration: "02:00" },
  { id: "aud_2", title: "Piano Inspiration", artist: "Raw Vibrations", duration: "03:44" },
  { id: "aud_3", title: "Chill Coffee Groove", artist: "Gummy MusicLab", duration: "01:59" },
  { id: "aud_4", title: "Happy Moments", artist: "INCO Studio", duration: "01:52" },
  { id: "aud_5", title: "Funk Music 10506", artist: "SonicMusic", duration: "02:13" },
  { id: "aud_6", title: "Fashion Funky Dance", artist: "SoundForYou", duration: "01:31" },
];

export function AudioPanel() {
  const addAudioTrack = useEditorStore((s) => s.addAudioTrack);
  const [playingId, setPlayingId] = useState<string | null>(null);

  function togglePlay(id: string) {
    setPlayingId(playingId === id ? null : id);
  }

  return (
    <SidebarPanel>
      <SidebarPanelHeader>
        <Search placeholder="Tìm kiếm âm thanh, nhạc nền..." />
      </SidebarPanelHeader>

      <SidebarPanelContent>
        <div className="flex flex-col gap-2 min-w-0">
          {MOCK_AUDIO_ITEMS.map((item) => {
            const isPlaying = playingId === item.id;
            return (
              <div
                key={item.id}
                draggable
                onDragStart={(event) => {
                  const img = new Image();
                  img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                  event.dataTransfer.setDragImage(img, 0, 0);
                  const parts = (item.duration || "").split(":").map(Number);
                  const durationSec = parts.length === 2 ? parts[0] * 60 + parts[1] : 10;
                  event.dataTransfer.setData(
                    AUDIO_LIBRARY_MIME,
                    JSON.stringify(item),
                  );
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
                }}
                className="group flex items-center justify-between gap-3 p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all cursor-grab active:cursor-grabbing select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => togglePlay(item.id)}
                    className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-[#27272A] text-[var(--fg-secondary)] hover:text-white transition-colors shrink-0 cursor-pointer"
                  >
                    {isPlaying ? (
                      <Pause size={15} fill="currentColor" />
                    ) : (
                      <Play size={15} fill="currentColor" className="ml-0.5" />
                    )}
                  </button>

                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] font-medium text-[var(--fg-primary)] truncate">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-[var(--fg-muted)] truncate">
                      {item.artist} · {item.duration}
                    </span>
                  </div>
                </div>

                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() =>
                    addAudioTrack({ role: item.title, assetId: item.title })
                  }
                  leftIcon={<Plus size={13} />}
                  className="shrink-0 opacity-90 group-hover:opacity-100"
                >
                  Thêm
                </Button>
              </div>
            );
          })}
        </div>
      </SidebarPanelContent>
    </SidebarPanel>
  );
}
