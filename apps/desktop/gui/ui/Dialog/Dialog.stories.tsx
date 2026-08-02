import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../Button/Button";
import { Dialog } from "./Dialog";

const meta = {
  title: "UI/Dialog",
  component: Dialog,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function DialogDemo() {
  const [open, setOpen] = useState(true);
  return (
    <div className="p-6">
      <Button variant="primary" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <Dialog
        open={open}
        title="New project"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Create
            </Button>
          </>
        }
      >
        <p className="m-0 text-[13px] text-[var(--fg-muted)]">
          Dialog body — confirm or dismiss.
        </p>
      </Dialog>
    </div>
  );
}

export const Default: Story = {
  args: {
    open: true,
    title: "Dialog",
    onClose: () => undefined,
    children: null,
  },
  render: () => <DialogDemo />,
};
