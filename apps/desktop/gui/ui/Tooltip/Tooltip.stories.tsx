import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/Button";
import { Tooltip } from "./Tooltip";

const meta = {
  title: "UI/Tooltip",
  component: Tooltip,
  args: {
    content: "Helpful tip",
    side: "top",
    children: <Button variant="outline">Hover me</Button>,
  },
  argTypes: {
    side: {
      control: "select",
      options: ["top", "bottom", "left", "right"],
    },
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Bottom: Story = {
  args: { side: "bottom", content: "Below the control" },
};
