import type { Meta, StoryObj } from "@storybook/react";
import { Tooltip } from "./Tooltip";
import { Button } from "../Button/Button";
import { Settings, CloudCheck, Gem, Upload, Info } from "lucide-react";

const meta: Meta<typeof Tooltip> = {
  title: "UI/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  argTypes: {
    side: {
      control: "select",
      options: ["top", "bottom", "left", "right"],
      description: "Hướng hiển thị của tooltip",
    },
    content: {
      control: "text",
      description: "Nội dung văn bản bên trong tooltip",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const DefaultTop: Story = {
  args: {
    content: "Đã lưu tự động vào đám mây",
    side: "top",
    children: (
      <Button variant="ghost" size="sm">
        <CloudCheck size={15} color="#22c55e" />
      </Button>
    ),
  },
};

export const Bottom: Story = {
  args: {
    content: "Cài đặt thông số dự án",
    side: "bottom",
    children: (
      <Button variant="action" size="sm" leftIcon={<Settings size={14} />}>
        Cài đặt
      </Button>
    ),
  },
};

export const Left: Story = {
  args: {
    content: "Nâng cấp tài khoản Pro",
    side: "left",
    children: (
      <Button variant="outline" size="sm" leftIcon={<Gem size={13} color="#eab308" />}>
        Pro
      </Button>
    ),
  },
};

export const Right: Story = {
  args: {
    content: "Xuất video chất lượng 4K",
    side: "right",
    children: (
      <Button variant="primary" size="sm" leftIcon={<Upload size={13} />}>
        Xuất
      </Button>
    ),
  },
};

/* All Sides Overview Story */
export const AllSidesPreview: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "32px", padding: "40px 20px", alignItems: "center", justifyContent: "center" }}>
      <Tooltip content="Hướng Top (Trên)" side="top">
        <Button variant="outline" size="sm">Hover Top</Button>
      </Tooltip>

      <Tooltip content="Hướng Bottom (Dưới)" side="bottom">
        <Button variant="outline" size="sm">Hover Bottom</Button>
      </Tooltip>

      <Tooltip content="Hướng Left (Trái)" side="left">
        <Button variant="outline" size="sm">Hover Left</Button>
      </Tooltip>

      <Tooltip content="Hướng Right (Phải)" side="right">
        <Button variant="outline" size="sm">Hover Right</Button>
      </Tooltip>
    </div>
  ),
};
