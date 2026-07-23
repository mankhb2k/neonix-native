import React from "react";
import { Plus } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";
import { MediaItem } from "../MediaItem/MediaItem";

export function FramePanel() {
  const project = useEditorStore((s) => s.project);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectScene = useEditorStore((s) => s.selectScene);

  return (
    <div className="flex flex-col w-full h-full">
      <div className="px-4 py-3 border-b border-[var(--line-strong)]">
        <h3 className="text-[14px] font-semibold text-[var(--fg)]">Khung hình</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Add New Frame Button */}
          <div className="flex flex-col gap-1.5 w-full cursor-pointer group">
            <div className="relative w-full aspect-[4/3] rounded-lg border-2 border-dashed border-[var(--line-strong)] flex flex-col items-center justify-center gap-2 text-[var(--fg-muted)] transition-colors hover:border-[var(--fg)] hover:text-[var(--fg)]">
              <Plus size={24} strokeWidth={1.5} />
              <span className="text-[12px] font-medium">Thêm khung hình</span>
            </div>
            <div className="text-[12px] font-medium text-transparent">Trống</div> {/* Spacer to align with text */}
          </div>

          {/* Existing Scenes */}
          {(project?.scenes ?? []).map((scene, index) => {
            const isActive = selectedSceneId === scene.id;
            return (
              <div 
                key={scene.id} 
                className="relative"
                onClick={() => selectScene(scene.id)}
              >
                <MediaItem
                  title={scene.role ?? `Scene ${index + 1}`}
                  duration={`${scene.duration}s`}
                  className={isActive ? "ring-2 ring-[var(--accent)] rounded-lg bg-[var(--bg-hover)]" : "opacity-80 hover:opacity-100"}
                />
                {isActive && (
                  <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--accent)]" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
