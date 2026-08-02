import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Search } from "./Search";

const meta = {
  title: "UI/Search",
  component: Search,
  decorators: [
    (Story) => (
      <div className="w-[280px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Search>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: "Search recent…" },
};

export const Controlled: Story = {
  render: () => {
    const [value, setValue] = useState("");
    return (
      <Search
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search…"
      />
    );
  },
};
