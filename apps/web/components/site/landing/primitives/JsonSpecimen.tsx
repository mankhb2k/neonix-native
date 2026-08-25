import { Fragment } from "react";

const TOKEN_RE =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

/**
 * Lightweight JSON syntax highlighter.
 *
 * Neon palette (Neonix, not Clipkit):
 * - keys      → fg-secondary
 * - strings   → cyan (accent-text)
 * - numbers   → magenta (accent-magenta)
 * - literals  → muted
 * - punctuation → muted (via untouched slice)
 */
export function JsonSpecimen({ code }: { code: string }) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of code.matchAll(TOKEN_RE)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      nodes.push(<Fragment key={key++}>{code.slice(lastIndex, idx)}</Fragment>);
    }

    const [full, str, colon, literal] = match;
    if (colon) {
      nodes.push(
        <span key={key++} style={{ color: "var(--fg-secondary)" }}>
          {str}
        </span>,
      );
      nodes.push(
        <span key={key++} style={{ color: "var(--fg-muted)" }}>
          {colon}
        </span>,
      );
    } else if (str) {
      nodes.push(
        <span key={key++} style={{ color: "var(--accent-text)" }}>
          {str}
        </span>,
      );
    } else if (literal != null) {
      nodes.push(
        <span key={key++} style={{ color: "var(--fg-muted)" }}>
          {literal}
        </span>,
      );
    } else {
      nodes.push(
        <span key={key++} style={{ color: "var(--accent-magenta)" }}>
          {match[0]}
        </span>,
      );
    }

    lastIndex = idx + full.length;
  }

  if (lastIndex < code.length) {
    nodes.push(<Fragment key={key++}>{code.slice(lastIndex)}</Fragment>);
  }

  return (
    <pre className="m-0 overflow-x-auto whitespace-pre text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
      {nodes}
    </pre>
  );
}
