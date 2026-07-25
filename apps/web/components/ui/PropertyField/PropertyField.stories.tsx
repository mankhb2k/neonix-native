import type { Meta, StoryObj } from "@storybook/react";
import { Plus, Eye } from "lucide-react";
import {
  PropertySection,
  PropertyRow,
  PropertyInput,
  PropertySelect,
  PropertyColor,
  PropertyIconButton,
} from "./PropertyField";

const meta: Meta = {
  title: "UI/PropertyField",
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

export const PositionRow: Story = {
  render: () => (
    <div style={{ width: 280, background: "var(--bg-panel)" }}>
      <PropertySection title="Vị trí">
        <PropertyRow>
          <PropertyInput prefix="X" type="number" stepper defaultValue={120} />
          <PropertyInput prefix="Y" type="number" stepper defaultValue={64} />
        </PropertyRow>
      </PropertySection>
    </div>
  ),
};

export const InputOnly: Story = {
  render: () => (
    <div style={{ width: 280, background: "var(--bg-panel)", padding: 12 }}>
      <PropertyInput label="Brand" defaultValue="Cà Phê Sáng" />
    </div>
  ),
};

export const WithStepper: Story = {
  render: () => (
    <div style={{ width: 280, background: "var(--bg-panel)", padding: 12 }}>
      <PropertyRow>
        <PropertyInput prefix="X" type="number" stepper defaultValue={0} />
        <PropertyInput
          label="Duration"
          prefix="s"
          type="number"
          step={0.1}
          min={0}
          stepper
          defaultValue={0.6}
        />
      </PropertyRow>
    </div>
  ),
};

export const FullPanel: Story = {
  render: () => (
    <div style={{ width: 280, background: "var(--bg-panel)" }}>
      <PropertySection title="Vị trí">
        <PropertyRow>
          <PropertyInput prefix="X" type="number" stepper defaultValue={0} />
          <PropertyInput prefix="Y" type="number" stepper defaultValue={0} />
        </PropertyRow>
      </PropertySection>

      <PropertySection
        title="Giao diện"
        action={
          <PropertyIconButton label="Hiện / ẩn">
            <Eye size={14} strokeWidth={1.5} />
          </PropertyIconButton>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <PropertyInput label="Brand" defaultValue="Cà Phê Sáng" />
          <PropertyColor label="Màu brand" value="#1A5D3A" />
        </div>
      </PropertySection>

      <PropertySection
        title="Hoạt hình"
        action={
          <PropertyIconButton label="Thêm">
            <Plus size={14} strokeWidth={1.5} />
          </PropertyIconButton>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <PropertySelect label="Preset" defaultValue="fade-in">
            <option value="fade-in">Hiện mờ dần</option>
            <option value="pop">Pop</option>
          </PropertySelect>
          <PropertyRow>
            <PropertyInput
              label="Duration"
              prefix="s"
              type="number"
              step={0.1}
              stepper
              defaultValue={0.6}
            />
            <PropertyInput
              label="Delay"
              prefix="s"
              type="number"
              step={0.1}
              stepper
              defaultValue={0}
            />
          </PropertyRow>
        </div>
      </PropertySection>
    </div>
  ),
};
