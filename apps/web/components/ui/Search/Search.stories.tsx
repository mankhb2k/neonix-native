import type { Meta, StoryObj } from "@storybook/react";
import { Search } from "./Search";

const meta: Meta<typeof Search> = {
  title: "UI/Search",
  component: Search,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof Search>;

export const Default: Story = {
  args: {
    placeholder: "Tìm kiếm mẫu video, âm thanh...",
  },
};

export const CustomWidth: Story = {
  args: {
    placeholder: "Tìm trong thanh công cụ...",
    className: "w-[240px]",
  },
};
