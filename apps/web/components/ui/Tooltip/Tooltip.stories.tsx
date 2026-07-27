import type { Meta, StoryObj } from "@storybook/react";
import { Tooltip } from "./Tooltip";
import { Button } from "../Button/Button";

const meta: Meta<typeof Tooltip> = {
  title: "UI/Tooltip",
  component: Tooltip,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    side: {
      control: "select",
      options: ["top", "bottom", "left", "right"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Top: Story = {
  args: {
    content: "Đã lưu tự động vào bộ nhớ",
    side: "top",
    children: <Button variant="secondary">Rê chuột vào đây (Top)</Button>,
  },
};

export const Bottom: Story = {
  args: {
    content: "Xuất video MP4 1080p",
    side: "bottom",
    children: <Button variant="primary">Rê chuột vào đây (Bottom)</Button>,
  },
};

export const Left: Story = {
  args: {
    content: "Xem trước thông số",
    side: "left",
    children: <Button variant="outline">Rê chuột vào đây (Left)</Button>,
  },
};

export const Right: Story = {
  args: {
    content: "Mở thanh cài đặt",
    side: "right",
    children: <Button variant="ghost">Rê chuột vào đây (Right)</Button>,
  },
};
