import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Select } from "./Select";

const options = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
];

const meta = {
  title: "UI/Select",
  component: Select,
  args: {
    label: "Aspect ratio",
    options,
    value: "16:9",
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Controlled: Story = {
  render: () => {
    const [value, setValue] = useState("16:9");
    return (
      <Select
        label="Aspect ratio"
        options={options}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    );
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};
