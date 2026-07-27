import type { Meta, StoryObj } from "@storybook/react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from "./ContextMenu";
import { Copy, Scissors, Trash2, Layers } from "lucide-react";

const meta: Meta = {
  title: "UI/ContextMenu",
  parameters: {
    layout: "centered",
  },
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-32 w-64 items-center justify-center rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--bg-panel)] text-sm text-[var(--fg-muted)]">
        Right-click (Chuột phải) ở đây
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>Thao tác Khung hình</ContextMenuLabel>
        <ContextMenuItem leftIcon={<Copy size={14} />} shortcut="Ctrl+C">
          Sao chép
        </ContextMenuItem>
        <ContextMenuItem leftIcon={<Scissors size={14} />} shortcut="Ctrl+X">
          Cắt
        </ContextMenuItem>
        <ContextMenuItem leftIcon={<Layers size={14} />} shortcut="Ctrl+D">
          Nhân bản
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem leftIcon={<Trash2 size={14} />} destructive shortcut="Del">
          Xóa khung hình
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
};
