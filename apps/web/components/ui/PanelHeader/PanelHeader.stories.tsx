import type { Meta, StoryObj } from "@storybook/react";
import { PanelHeader } from "./PanelHeader";
import { TabsDesktop } from "../TabsDesktop/TabsDesktop";

const meta: Meta<typeof PanelHeader> = {
  title: "UI/PanelHeader",
  component: PanelHeader,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof PanelHeader>;

export const Default: Story = {
  args: {
    title: "Trình phát",
  },
};

export const WithActions: Story = {
  args: {
    title: "Văn bản",
    actions: <span className="text-[11px] text-[var(--fg-muted)]">Cài đặt</span>,
  },
};

export const WithTabs: Story = {
  render: () => (
    <PanelHeader className="px-0">
      <TabsDesktop
        items={[
          { id: "frame", label: "Khung hình" },
          { id: "elements", label: "Thành phần" },
          { id: "text", label: "Văn bản" },
          { id: "upload", label: "Phương tiện" },
          { id: "stickers", label: "Nhãn dán" },
          { id: "effects", label: "Hiệu ứng" },
        ]}
        value="frame"
        onChange={() => {}}
      />
    </PanelHeader>
  ),
};
