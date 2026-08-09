import type { TextCategory } from "./types";

/** Preset text — desktop TextPanel ABC + vài mẫu thường dùng. */
export const TEXT_CATEGORIES: TextCategory[] = [
  {
    title: "Mẫu văn bản",
    items: [
      {
        id: "text-abc",
        label: "Văn bản ABC",
        text: "ABC",
        preview: (
          <span className="text-[18px] font-extrabold tracking-wider text-[var(--fg-primary)]">
            ABC
          </span>
        ),
      },
      {
        id: "text-heading",
        label: "Tiêu đề",
        text: "Tiêu đề",
        preview: (
          <span className="text-[15px] font-bold tracking-tight text-[var(--fg-primary)]">
            Aa
          </span>
        ),
      },
      {
        id: "text-subtitle",
        label: "Phụ đề",
        text: "Phụ đề",
        preview: (
          <span className="text-[13px] font-semibold text-[var(--fg-secondary)]">
            Aa
          </span>
        ),
      },
      {
        id: "text-body",
        label: "Đoạn văn",
        text: "Thêm văn bản của bạn",
        preview: (
          <span className="text-[12px] font-medium text-[var(--fg-muted)]">
            Aa
          </span>
        ),
      },
    ],
  },
];
