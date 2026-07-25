"use client";

import { useEditorStore } from "@/lib/store/editor-store";
import { Tabs, type TabItem } from "@/components/ui";
import { Frame, Shapes, Type, CloudUpload } from "lucide-react";

const ICON_PROPS = { size: 14, strokeWidth: 1.2 };

const RIBBON_TABS: TabItem[] = [
  {
    id: "frame",
    label: "Khung hình",
    icon: <Frame {...ICON_PROPS} />,
  },
  {
    id: "elements",
    label: "Thành phần",
    icon: <Shapes {...ICON_PROPS} />,
  },
  {
    id: "text",
    label: "Văn bản",
    icon: <Type {...ICON_PROPS} />,
  },
  {
    id: "upload",
    label: "Phương tiện",
    icon: <CloudUpload {...ICON_PROPS} />,
  },
];

export function RibbonBar() {
  const activeSidebarTab = useEditorStore((s) => s.activeSidebarTab);
  const setActiveSidebarTab = useEditorStore((s) => s.setActiveSidebarTab);

  return (
    <div className="flex h-[36px] items-center px-3 bg-[var(--bg-panel)]">
      <Tabs
        items={RIBBON_TABS}
        value={activeSidebarTab}
        onChange={setActiveSidebarTab}
        variant="pills"
        rounded="md"
        size="sm"
        borderless
      />
    </div>
  );
}
