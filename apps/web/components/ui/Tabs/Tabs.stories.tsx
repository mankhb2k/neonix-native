import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Tabs, type TabItem } from "./Tabs";
import { Home, PlusCircle, Palette, Sparkles, Settings, FileText, Image as ImageIcon, Music } from "lucide-react";

const meta: Meta<typeof Tabs> = {
  title: "UI/Tabs",
  component: Tabs,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["underline", "pills", "segment"],
      description: "Biến thể giao diện (gạch chân, viên thuốc, phân đoạn)",
    },
    rounded: {
      control: "select",
      options: ["none", "sm", "md", "lg", "full"],
      description: "Độ bo góc của tab",
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description: "Kích thước tab",
    },
    borderless: {
      control: "boolean",
      description: "Tắt viền/khung border hoàn toàn",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  args: {
    variant: "pills",
    rounded: "md",
    size: "sm",
    borderless: true,
  },
  render: (args) => {
    const [active, setActive] = useState("home");
    const items: TabItem[] = [
      { id: "home", label: "Trang đầu" },
      { id: "insert", label: "Chèn" },
      { id: "draw", label: "Vẽ" },
      { id: "design", label: "Thiết kế" },
      { id: "animation", label: "Hoạt hình" },
    ];
    return (
      <div style={{ padding: "20px 0" }}>
        <p style={{ fontSize: "12px", color: "var(--fg-muted)", marginBottom: "16px" }}>
          🎛️ Bật / Tắt thuộc tính borderless ở bảng Controls bên phải để xem hiệu ứng không viền:
        </p>
        <Tabs {...args} items={items} value={active} onChange={setActive} />
      </div>
    );
  },
};

export const AnimatedSlidingBar: Story = {
  args: {
    variant: "underline",
    size: "sm",
    borderless: false,
  },
  render: (args) => {
    const [active, setActive] = useState("home");
    const items: TabItem[] = [
      { id: "home", label: "Trang đầu" },
      { id: "insert", label: "Chèn" },
      { id: "draw", label: "Vẽ" },
      { id: "design", label: "Thiết kế" },
      { id: "animation", label: "Hoạt hình" },
    ];
    return (
      <div style={{ padding: "20px 0" }}>
        <p style={{ fontSize: "12px", color: "var(--fg-muted)", marginBottom: "16px" }}>
          ✨ Click chuyển tab bên dưới để thấy thanh gạch chân trượt chuyển động mượt mà (Animated Sliding Bar):
        </p>
        <Tabs {...args} items={items} value={active} onChange={setActive} />
      </div>
    );
  },
};

export const RoundedVariants: Story = {
  render: () => {
    const [active, setActive] = useState("text");
    const items: TabItem[] = [
      { id: "text", label: "Văn bản", icon: <FileText size={14} strokeWidth={1.2} /> },
      { id: "image", label: "Hình ảnh", icon: <ImageIcon size={14} strokeWidth={1.2} /> },
      { id: "audio", label: "Âm thanh", icon: <Music size={14} strokeWidth={1.2} /> },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div>
          <p style={{ fontSize: "12px", color: "var(--fg-muted)", margin: "0 0 8px" }}>
            🔵 rounded="full" (Bo tròn dạng viên thuốc / Hạt đậu):
          </p>
          <Tabs items={items} value={active} onChange={setActive} variant="pills" rounded="full" size="sm" borderless />
        </div>

        <div>
          <p style={{ fontSize: "12px", color: "var(--fg-muted)", margin: "0 0 8px" }}>
            🔲 rounded="md" (Bo góc nhẹ 6px):
          </p>
          <Tabs items={items} value={active} onChange={setActive} variant="pills" rounded="md" size="sm" borderless />
        </div>

        <div>
          <p style={{ fontSize: "12px", color: "var(--fg-muted)", margin: "0 0 8px" }}>
            ⬛ rounded="none" (Vuông vức sắc cạnh):
          </p>
          <Tabs items={items} value={active} onChange={setActive} variant="pills" rounded="none" size="sm" borderless />
        </div>
      </div>
    );
  },
};

export const IconOnlyWithTooltip: Story = {
  render: () => {
    const [active, setActive] = useState("home");
    const items: TabItem[] = [
      { id: "home", icon: <Home size={16} strokeWidth={1.2} />, tooltip: "Trang chủ" },
      { id: "add", icon: <PlusCircle size={16} strokeWidth={1.2} />, tooltip: "Thêm tài nguyên" },
      { id: "palette", icon: <Palette size={16} strokeWidth={1.2} />, tooltip: "Thiết kế & Màu sắc" },
      { id: "ai", icon: <Sparkles size={16} strokeWidth={1.2} />, tooltip: "Trợ lý AI Copilot" },
      { id: "settings", icon: <Settings size={16} strokeWidth={1.2} />, tooltip: "Cài đặt dự án" },
    ];
    return (
      <div style={{ padding: "20px 0" }}>
        <p style={{ fontSize: "12px", color: "var(--fg-muted)", marginBottom: "16px" }}>
          💡 Di chuột dừng khoảng 0.5s vào các icon bên dưới để thấy Tooltip hiện lên:
        </p>
        <Tabs items={items} value={active} onChange={setActive} variant="segment" rounded="md" size="md" borderless />
      </div>
    );
  },
};
