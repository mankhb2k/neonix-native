import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/Button";
import { PanelHeader } from "./PanelHeader";

const meta = {
  title: "UI/PanelHeader",
  component: PanelHeader,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="w-[360px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-panel)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PanelHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { title: "Projects" },
};

export const WithActions: Story = {
  args: {
    title: "Projects",
    actions: (
      <Button variant="ghost" size="xs">
        Diagnostics
      </Button>
    ),
  },
};

export const NoBorder: Story = {
  args: { title: "Media", noBorder: true },
};
