import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus } from "lucide-react";
import { Button } from "./Button";

const meta = {
  title: "UI/Button",
  component: Button,
  args: {
    children: "Button",
    variant: "action",
    size: "sm",
  },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "primary",
        "secondary",
        "outline",
        "ghost",
        "danger",
        "link",
        "action",
      ],
    },
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Primary: Story = {
  args: { variant: "primary", children: "Save" },
};

export const Loading: Story = {
  args: { loading: true, children: "Saving…" },
};

export const WithIcon: Story = {
  args: {
    variant: "primary",
    leftIcon: <Plus size={14} />,
    children: "New project",
  },
};

export const IconOnly: Story = {
  args: {
    iconOnly: true,
    "aria-label": "Add",
    leftIcon: <Plus size={14} />,
    children: undefined,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(
        [
          "primary",
          "secondary",
          "action",
          "outline",
          "ghost",
          "danger",
          "link",
        ] as const
      ).map((variant) => (
        <Button key={variant} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};
