import type { Meta, StoryObj } from "@storybook/react";
import {
  PropertySection,
  PropertyRow,
  PropertyInput,
  PropertySelect,
  PropertyColor,
  PropertyIconButton,
} from "./PropertyField";
import { Plus, Eye } from "lucide-react";

const meta: Meta = {
  title: "UI/PropertyField",
  parameters: {
    layout: "padded",
  },
};

export default meta;

export const FullInspectorFields: StoryObj = {
  render: () => (
    <div className="w-[320px] rounded-xl border border-[var(--line-strong)] bg-[var(--bg-panel)] p-2">
      <PropertySection title="Vị trí">
        <PropertyRow>
          <PropertyInput id="x" prefix="X" type="number" defaultValue={540} stepper />
          <PropertyInput id="y" prefix="Y" type="number" defaultValue={960} stepper />
        </PropertyRow>
      </PropertySection>

      <PropertySection title="Bố cục">
        <PropertyRow>
          <PropertyInput id="duration" label="Thời lượng" prefix="s" defaultValue={5} stepper />
          <PropertySelect id="aspect" label="Tỉ lệ" defaultValue="9:16">
            <option value="9:16">9:16</option>
            <option value="16:9">16:9</option>
            <option value="1:1">1:1</option>
          </PropertySelect>
        </PropertyRow>
      </PropertySection>

      <PropertySection
        title="Giao diện"
        action={
          <PropertyIconButton label="Hiện/Ẩn">
            <Eye size={14} />
          </PropertyIconButton>
        }
      >
        <div className="flex flex-col gap-2">
          <PropertyInput id="brand" label="Brand" defaultValue="MotionVideo" />
          <PropertyColor label="Màu Brand" value="#1A5D3A" />
        </div>
      </PropertySection>
    </div>
  ),
};
