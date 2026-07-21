"use client";

export type EditorTool =
  | "scenes"
  | "templates"
  | "text"
  | "audio"
  | "effects";

const TOOLS: Array<{ id: EditorTool; label: string; icon: string }> = [
  { id: "scenes", label: "Cảnh", icon: "▣" },
  { id: "templates", label: "Mẫu", icon: "▤" },
  { id: "text", label: "Văn bản", icon: "T" },
  { id: "audio", label: "Âm thanh", icon: "♪" },
  { id: "effects", label: "Hiệu ứng", icon: "✦" },
];

type Props = {
  active: EditorTool;
  onChange: (tool: EditorTool) => void;
};

export function IconNav({ active, onChange }: Props) {
  return (
    <nav className="mv-icon-nav" aria-label="Công cụ">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className={`mv-icon-nav-item${active === tool.id ? " is-active" : ""}`}
          onClick={() => onChange(tool.id)}
        >
          <span className="mv-icon-nav-glyph" aria-hidden>
            {tool.icon}
          </span>
          <span className="mv-icon-nav-label">{tool.label}</span>
        </button>
      ))}
    </nav>
  );
}
