import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";
import { Download, Trash2, Plus } from "lucide-react";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "outline", "ghost", "danger"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    children: "Nút bấm Primary",
    variant: "primary",
    size: "md",
  },
};

export const Secondary: Story = {
  args: {
    children: "Nút bấm Secondary",
    variant: "secondary",
    size: "md",
  },
};

export const Outline: Story = {
  args: {
    children: "Nút bấm Outline",
    variant: "outline",
    size: "md",
  },
};

export const Ghost: Story = {
  args: {
    children: "Nút bấm Ghost",
    variant: "ghost",
    size: "md",
  },
};

export const Danger: Story = {
  args: {
    children: "Xóa dự án",
    variant: "danger",
    size: "md",
    leftIcon: <Trash2 size={14} />,
  },
};

export const WithIcons: Story = {
  args: {
    children: "Tải xuống",
    variant: "primary",
    leftIcon: <Download size={14} />,
    rightIcon: <Plus size={14} />,
  },
};

export const Disabled: Story = {
  args: {
    children: "Không thể nhấp",
    disabled: true,
    variant: "primary",
  },
};
