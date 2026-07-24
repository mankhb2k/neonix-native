import React from "react";
import {
  Plus,
  Scissors,
  Copy,
  ClipboardPaste,
  CopyPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEditorStore, type SceneRole } from "@/lib/store/editor-store";
import { MediaItem } from "../MediaItem/MediaItem";
import {
  SidebarPanel,
  SidebarPanelHeader,
  SidebarPanelContent,
} from "../SidebarPanel/SidebarPanel";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui";

const SCENE_ROLES: SceneRole[] = [
  "hook",
  "pain",
  "benefit",
  "demo",
  "offer",
  "cta",
  "logo",
];

function promptRename(current?: string): SceneRole | null {
  const next = window.prompt(
    `Đổi tên khung hình (${SCENE_ROLES.join(", ")})`,
    current ?? "hook",
  );
  if (!next) return null;
  const normalized = next.trim().toLowerCase() as SceneRole;
  return SCENE_ROLES.includes(normalized) ? normalized : null;
}

export function FramePanel() {
  const project = useEditorStore((s) => s.project);
  const sceneClipboard = useEditorStore((s) => s.sceneClipboard);
  const selectScene = useEditorStore((s) => s.selectScene);
  const copyScene = useEditorStore((s) => s.copyScene);
  const cutScene = useEditorStore((s) => s.cutScene);
  const pasteScene = useEditorStore((s) => s.pasteScene);
  const duplicateScene = useEditorStore((s) => s.duplicateScene);
  const renameScene = useEditorStore((s) => s.renameScene);
  const deleteScene = useEditorStore((s) => s.deleteScene);

  const scenes = project?.scenes ?? [];
  const canRemove = scenes.length > 1;
  const canPaste = Boolean(sceneClipboard);

  return (
    <SidebarPanel>
      <SidebarPanelHeader>Khung hình</SidebarPanelHeader>
      <SidebarPanelContent>
        <div className="grid grid-cols-2 gap-3">
          {scenes.map((scene, index) => (
            <ContextMenu key={scene.id}>
              <ContextMenuTrigger
                className="w-full"
                onOpen={() => selectScene(scene.id)}
              >
                <MediaItem
                  title={scene.semantic?.role ?? scene.name ?? `Scene ${index + 1}`}
                  duration={`${scene.duration}s`}
                  onClick={() => selectScene(scene.id)}
                />
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  leftIcon={<Scissors size={14} />}
                  shortcut="Ctrl+X"
                  disabled={!canRemove}
                  onSelect={() => cutScene(scene.id)}
                >
                  Cắt
                </ContextMenuItem>
                <ContextMenuItem
                  leftIcon={<Copy size={14} />}
                  shortcut="Ctrl+C"
                  onSelect={() => copyScene(scene.id)}
                >
                  Sao chép
                </ContextMenuItem>
                <ContextMenuItem
                  leftIcon={<ClipboardPaste size={14} />}
                  shortcut="Ctrl+V"
                  disabled={!canPaste}
                  onSelect={() => pasteScene(scene.id)}
                >
                  Dán
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  leftIcon={<CopyPlus size={14} />}
                  shortcut="Ctrl+D"
                  onSelect={() => duplicateScene(scene.id)}
                >
                  Nhân đôi
                </ContextMenuItem>
                <ContextMenuItem
                  leftIcon={<Pencil size={14} />}
                  onSelect={() => {
                    const role = promptRename(scene.semantic?.role);
                    if (role) renameScene(scene.id, role);
                  }}
                >
                  Đổi tên
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  leftIcon={<Trash2 size={14} />}
                  destructive
                  disabled={!canRemove}
                  onSelect={() => deleteScene(scene.id)}
                >
                  Xóa
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}

          <div className="flex flex-col gap-1.5 w-full cursor-pointer">
            <div className="relative w-full aspect-[4/3] rounded-lg border-2 border-dashed border-[var(--line-strong)] flex flex-col items-center justify-center gap-2 text-[var(--fg-muted)]">
              <Plus size={24} strokeWidth={1.5} />
              <span className="text-[12px] font-medium">Thêm khung hình</span>
            </div>
            <div className="text-[12px] font-medium text-transparent">.</div>
          </div>
        </div>
      </SidebarPanelContent>
    </SidebarPanel>
  );
}
