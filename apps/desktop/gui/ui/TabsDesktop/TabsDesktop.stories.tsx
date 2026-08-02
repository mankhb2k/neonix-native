import type { Meta, StoryObj } from "@storybook/react-vite";
import { Film, Layers, Music } from "lucide-react";
import { useState } from "react";
import { TabsDesktop } from "./TabsDesktop";

const items = [
  { id: "media", label: "Media", icon: <Film size={14} /> },
  { id: "layers", label: "Layers", icon: <Layers size={14} /> },
  { id: "audio", label: "Audio", icon: <Music size={14} /> },
];

const meta = {
  title: "UI/TabsDesktop",
  component: TabsDesktop,
  decorators: [
    (Story) => (
      <div className="h-10 w-[420px] border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TabsDesktop>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("media");
    return <TabsDesktop items={items} value={value} onChange={setValue} />;
  },
};

export const Stacked: Story = {
  render: () => {
    const [value, setValue] = useState("layers");
    return (
      <TabsDesktop items={items} value={value} onChange={setValue} stacked />
    );
  },
};
