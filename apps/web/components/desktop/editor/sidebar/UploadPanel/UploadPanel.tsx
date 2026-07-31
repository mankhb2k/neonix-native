"use client";

import { Upload } from "lucide-react";
import { Button } from "@/components/ui";
import { MOCK_IMAGES, MOCK_VIDEOS } from "@/lib/editor/sidebar-mock-library";
import { LibraryDragSource } from "../LibraryDragSource";
import { MediaItem } from "../MediaItem/MediaItem";
import {
  SidebarPanel,
  SidebarPanelHeader,
  SidebarPanelContent,
} from "../SidebarPanel/SidebarPanel";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function UploadPanel() {
  return (
    <SidebarPanel>
      <SidebarPanelHeader>
        <Button
          variant="outline"
          size="md"
          className="w-full"
          leftIcon={<Upload size={14} />}
        >
          Tải tệp
        </Button>
      </SidebarPanelHeader>
      <SidebarPanelContent>
        <div className="flex flex-col gap-4 min-w-0">
          <section className="flex flex-col gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)] px-0.5">
              Video
            </h3>
            <div className="grid grid-cols-[repeat(auto-fill,128px)] gap-3 justify-start">
              {MOCK_VIDEOS.map((item) => (
                <LibraryDragSource key={item.id} draft={item}>
                  <MediaItem
                    title={item.name}
                    duration={formatDuration(item.duration)}
                    thumbnailUrl={item.thumbnailUrl}
                  />
                </LibraryDragSource>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)] px-0.5">
              Hình ảnh
            </h3>
            <div className="grid grid-cols-[repeat(auto-fill,128px)] gap-3 justify-start">
              {MOCK_IMAGES.map((item) => (
                <LibraryDragSource key={item.id} draft={item}>
                  <MediaItem
                    title={item.name}
                    duration={formatDuration(item.duration)}
                    thumbnailUrl={item.thumbnailUrl}
                  />
                </LibraryDragSource>
              ))}
            </div>
          </section>
        </div>
      </SidebarPanelContent>
    </SidebarPanel>
  );
}
