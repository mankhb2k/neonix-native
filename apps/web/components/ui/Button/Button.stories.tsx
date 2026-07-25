import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "outline", "ghost", "danger", "link", "action"],
      description: "Biến thể giao diện của nút",
    },
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg"],
      description: "Kích thước nút",
    },
    iconOnly: {
      control: "boolean",
      description: "Chỉ hiển thị icon (nút vuông)",
    },
    loading: {
      control: "boolean",
      description: "Trạng thái đang nạp / chờ",
    },
    disabled: {
      control: "boolean",
      description: "Trạng thái vô hiệu hóa",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

const DemoLabel = ({ children }: { children: React.ReactNode }) => (
  <p
    style={{
      fontSize: "11px",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      color: "var(--fg-muted)",
      fontWeight: 600,
      marginBottom: "12px",
    }}
  >
    {children}
  </p>
);

const DemoBox = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "16px",
      padding: "24px",
      border: "1px dashed var(--line-strong)",
      borderRadius: "8px",
      background: "var(--bg-elevated)",
      flexWrap: "wrap",
    }}
  >
    {children}
  </div>
);

const ArrowIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14" />
    <path d="M12 5l7 7-7 7" />
  </svg>
);

export const Primary: Story = {
  args: {
    variant: "primary",
    children: "Primary Button",
  },
};

export const Variants: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <DemoLabel>Color variants</DemoLabel>
        <DemoBox>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="link">Link Button</Button>
        </DemoBox>
      </div>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <DemoLabel>Sizes</DemoLabel>
        <DemoBox>
          <Button size="xs">Extra Small</Button>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </DemoBox>
      </div>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <DemoLabel>States</DemoLabel>
        <DemoBox>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button variant="outline" loading>
            Loading Outline
          </Button>
        </DemoBox>
      </div>
    </div>
  ),
};

export const Icons: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <DemoLabel>Icon-only buttons (iconOnly)</DemoLabel>
        <DemoBox>
          <Button size="xs" iconOnly aria-label="Next">
            <ArrowIcon />
          </Button>
          <Button size="sm" iconOnly aria-label="Next">
            <ArrowIcon />
          </Button>
          <Button size="md" iconOnly aria-label="Next">
            <ArrowIcon />
          </Button>
          <Button size="lg" iconOnly aria-label="Next">
            <ArrowIcon />
          </Button>
        </DemoBox>
      </div>
    </div>
  ),
};
