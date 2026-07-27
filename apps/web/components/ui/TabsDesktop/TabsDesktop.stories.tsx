import type { Meta, StoryObj } from "@storybook/react";
import { TabsDesktop } from "./TabsDesktop";
import { Frame, Shapes, Type, CloudUpload, Smile, Sparkles } from "lucide-react";

const meta: Meta<typeof TabsDesktop> = {
  title: "UI/TabsDesktop",
  component: TabsDesktop,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof TabsDesktop>;

export const Default: Story = {
  args: {
    items: [
      { id: "frame", label: "Khung hình", icon: <Frame size={15} /> },
      { id: "elements", label: "Thành phần", icon: <Shapes size={15} /> },
      { id: "text", label: "Văn bản", icon: <Type size={15} /> },
      { id: "upload", label: "Phương tiện", icon: <CloudUpload size={15} /> },
      { id: "stickers", label: "Nhãn dán", icon: <Smile size={15} /> },
      { id: "effects", label: "Hiệu ứng", icon: <Sparkles size={15} /> },
    ],
    value: "frame",
    onChange: () => {},
  },
};
