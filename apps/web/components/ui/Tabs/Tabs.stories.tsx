import type { Meta, StoryObj } from "@storybook/react";
import { Tabs } from "./Tabs";
import { Frame, Shapes, Type } from "lucide-react";

const meta: Meta<typeof Tabs> = {
  title: "UI/Tabs",
  component: Tabs,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["underline", "pills", "segment"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
    rounded: {
      control: "select",
      options: ["none", "sm", "md", "lg", "full"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

const sampleItems = [
  { id: "frame", label: "Khung hình", icon: <Frame size={14} /> },
  { id: "elements", label: "Thành phần", icon: <Shapes size={14} /> },
  { id: "text", label: "Văn bản", icon: <Type size={14} /> },
];

export const Underline: Story = {
  args: {
    items: sampleItems,
    value: "frame",
    variant: "underline",
    onChange: () => {},
  },
};

export const Pills: Story = {
  args: {
    items: sampleItems,
    value: "elements",
    variant: "pills",
    onChange: () => {},
  },
};

export const Segment: Story = {
  args: {
    items: sampleItems,
    value: "text",
    variant: "segment",
    onChange: () => {},
  },
};
