import type { Meta, StoryObj } from "@storybook/react";
import { useState, type ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from "./ContextMenu";
import {
  Copy,
  ClipboardPaste,
  Scissors,
  Trash2,
  Pencil,
  FolderOpen,
  Download,
  Share2,
  Layers,
} from "lucide-react";

const meta: Meta<typeof ContextMenu> = {
  title: "UI/ContextMenu",
  component: ContextMenu,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ContextMenu>;

const Area = ({
  children,
  label = "Chuột phải vào đây",
}: {
  children?: ReactNode;
  label?: string;
}) => (
  <div
    style={{
      width: 320,
      height: 180,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "1px dashed var(--line-strong)",
      borderRadius: 8,
      background: "var(--bg-panel)",
      color: "var(--fg-muted)",
      fontSize: 13,
      userSelect: "none",
    }}
  >
    {children ?? label}
  </div>
);

export const Default: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger>
        <Area />
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem leftIcon={<Copy size={14} />} shortcut="Ctrl+C">
          Sao chép
        </ContextMenuItem>
        <ContextMenuItem leftIcon={<ClipboardPaste size={14} />} shortcut="Ctrl+V">
          Dán
        </ContextMenuItem>
        <ContextMenuItem leftIcon={<Scissors size={14} />} shortcut="Ctrl+X">
          Cắt
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem leftIcon={<Trash2 size={14} />} destructive>
          Xóa
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger>
        <Area label="Menu có nhóm / nhãn" />
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>Chỉnh sửa</ContextMenuLabel>
        <ContextMenuItem leftIcon={<Pencil size={14} />}>Đổi tên</ContextMenuItem>
        <ContextMenuItem leftIcon={<Copy size={14} />}>Nhân bản</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuLabel>Xuất</ContextMenuLabel>
        <ContextMenuItem leftIcon={<Download size={14} />}>Tải xuống</ContextMenuItem>
        <ContextMenuItem leftIcon={<Share2 size={14} />}>Chia sẻ</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
};

export const WithDisabledItems: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger>
        <Area label="Một số mục bị vô hiệu hóa" />
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem leftIcon={<FolderOpen size={14} />}>Mở</ContextMenuItem>
        <ContextMenuItem leftIcon={<Layers size={14} />} disabled>
          Gộp lớp (không khả dụng)
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem leftIcon={<Trash2 size={14} />} destructive disabled>
          Xóa (không khả dụng)
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
};

export const Interactive: Story = {
  render: () => {
    const [lastAction, setLastAction] = useState<string>("—");

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
        <p style={{ fontSize: 12, color: "var(--fg-muted)", margin: 0 }}>
          Hành động gần nhất: <strong style={{ color: "var(--fg)" }}>{lastAction}</strong>
        </p>
        <ContextMenu>
          <ContextMenuTrigger>
            <Area label="Chuột phải rồi chọn một mục" />
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              leftIcon={<Copy size={14} />}
              onSelect={() => setLastAction("Sao chép")}
            >
              Sao chép
            </ContextMenuItem>
            <ContextMenuItem
              leftIcon={<Pencil size={14} />}
              onSelect={() => setLastAction("Đổi tên")}
            >
              Đổi tên
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              leftIcon={<Trash2 size={14} />}
              destructive
              onSelect={() => setLastAction("Xóa")}
            >
              Xóa
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    );
  },
};
