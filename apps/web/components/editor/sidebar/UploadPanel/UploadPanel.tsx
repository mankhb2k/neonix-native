import React from "react";
import { MediaItem } from "../MediaItem/MediaItem";

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
    <div className="flex flex-col w-full h-full">
      <div className="px-4 py-3 border-b border-[var(--line-strong)]">
        <h3 className="text-[14px] font-semibold text-[var(--fg)]">Tải lên</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
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
      </div>
    </div>
  );
}
