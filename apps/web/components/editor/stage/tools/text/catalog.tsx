import type { TextCategory } from "./types";

/** Text presets â€” common building blocks for the editor text library. */
export const TEXT_CATEGORIES: TextCategory[] = [
  {
    title: "Text presets",
    items: [
      {
        id: "text-abc",
        label: "ABC text",
        text: "ABC",
        preview: (
          <span className="text-[18px] font-extrabold tracking-wider text-[var(--fg-primary)]">
            ABC
          </span>
        ),
      },
      {
        id: "text-heading",
        label: "Heading",
        text: "Heading",
        preview: (
          <span className="text-[15px] font-bold tracking-tight text-[var(--fg-primary)]">
            Aa
          </span>
        ),
      },
      {
        id: "text-subtitle",
        label: "Subtitle",
        text: "Subtitle",
        preview: (
          <span className="text-[13px] font-semibold text-[var(--fg-secondary)]">
            Aa
          </span>
        ),
      },
      {
        id: "text-body",
        label: "Body copy",
        text: "Add your text",
        preview: (
          <span className="text-[12px] font-medium text-[var(--fg-muted)]">
            Aa
          </span>
        ),
      },
    ],
  },
];


