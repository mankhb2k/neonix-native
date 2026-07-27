import React from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui";
import { MediaItem } from "../MediaItem/MediaItem";
import { SidebarPanel, SidebarPanelHeader, SidebarPanelContent } from "../SidebarPanel/SidebarPanel";

const UPLOAD_ITEMS = [
  {
    title: "test-1.mp4",
    duration: "00:22",
    thumbnailUrl: "https://images.unsplash.com/photo-1518131672697-613becd4fab5?w=200&h=150&fit=crop",
  },
  {
    title: "Killua Zoldyck.jpg",
    isAdded: true,
    thumbnailUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200&h=150&fit=crop",
  },
  {
    title: "UpscaleImage_6|2...",
    logoText: "KLING AI",
  },
  {
    title: "Kling-AI.png",
    logoText: "KLING AI",
  },
  {
    title: "imagine-logo-alt.w...",
    logoText: "ImagineArt",
  },
  {
    title: "UpscaleImage_4|2...",
    logoText: "ImagineArt",
  },
  {
    title: "Untitled-design-4...",
    logoText: "ImagineArt",
  },
  {
    title: "UpscaleImage_2|2...",
    logoText: "DALL·E 3",
  },
  {
    title: "images.png",
    logoText: "DALL·E 3",
  },
  {
    title: "UpscaleImage_1_2...",
    thumbnailUrl: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=200&h=150&fit=crop",
  },
];

export function UploadPanel() {
  return (
    <SidebarPanel>
      <SidebarPanelHeader>
        <Button variant="outline" size="md" className="w-full" leftIcon={<Upload size={14} />}>
          Tải tệp
        </Button>
      </SidebarPanelHeader>
      <SidebarPanelContent>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 min-w-0">
          {UPLOAD_ITEMS.map((item, i) => (
            <MediaItem
              key={i}
              title={item.title}
              duration={item.duration}
              isAdded={item.isAdded}
              thumbnailUrl={item.thumbnailUrl}
              logoText={item.logoText}
            />
          ))}
        </div>
      </SidebarPanelContent>
    </SidebarPanel>
  );
}
