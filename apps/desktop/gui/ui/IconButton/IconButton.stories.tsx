import type { Meta, StoryObj } from "@storybook/react-vite";
import { Settings, X } from "lucide-react";
import { IconButton } from "./IconButton";

const meta = {
  title: "UI/IconButton",
  component: IconButton,
  args: {
    "aria-label": "Settings",
    children: <Settings size={14} />,
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Close: Story = {
  args: {
    "aria-label": "Close",
    children: <X size={14} />,
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};
