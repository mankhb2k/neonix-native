import type { ReactNode } from "react";

const shellClass = "min-h-screen bg-[var(--bg-site)] text-[var(--fg-primary)]";

// The header is rendered once by the parent (marketing) layout
// (_components/Header), which is pathname-aware and highlights the
// right tab for every route in this group, docs included.
export default function DocsLayout({ children }: { children: ReactNode }) {
  return <div className={shellClass}>{children}</div>;
}
