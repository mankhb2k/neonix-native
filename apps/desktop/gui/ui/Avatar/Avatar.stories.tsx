import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "./Avatar";

const meta = {
  title: "UI/Avatar",
  component: Avatar,
  args: {
    size: "md",
    variant: "user",
    fallback: "U",
    rounded: "full",
  },
  argTypes: {
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg"],
    },
    variant: {
      control: "select",
      options: ["user", "logo"],
    },
    rounded: {
      control: "text",
      description: '"full" or a number (px)',
    },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const User: Story = {
  args: { variant: "user", fallback: "A", rounded: "full" },
};

export const Logo: Story = {
  args: { variant: "logo", fallback: "M", alt: "Home", rounded: 4 },
};

export const Rounded2: Story = {
  args: { variant: "logo", fallback: "M", rounded: 2 },
};

export const WithImage: Story = {
  args: {
    variant: "user",
    rounded: "full",
    src: "https://api.dicebear.com/9.x/avataaars/svg?seed=moticlip",
    alt: "User",
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar size="xs" variant="logo" fallback="M" rounded={4} />
      <Avatar size="sm" variant="logo" fallback="M" rounded={4} />
      <Avatar size="md" variant="user" fallback="U" rounded="full" />
      <Avatar size="lg" variant="user" fallback="U" rounded={8} />
    </div>
  ),
};
