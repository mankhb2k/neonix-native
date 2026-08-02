import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./ContextMenu";

const meta = {
  title: "UI/ContextMenu",
  component: ContextMenu,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ContextMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-32 w-64 items-center justify-center rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--bg-panel)] text-[13px] text-[var(--fg-muted)]">
        Right-click here
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => undefined}>Cut</ContextMenuItem>
        <ContextMenuItem onSelect={() => undefined}>Copy</ContextMenuItem>
        <ContextMenuItem onSelect={() => undefined}>Paste</ContextMenuItem>
        <ContextMenuItem disabled onSelect={() => undefined}>
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
};
