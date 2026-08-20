import type { ReactNode } from "react";
import { DocsChromeHeader } from "@/components/docs/DocsChromeHeader";

const shellClass = "min-h-screen bg-[var(--bg-site)] text-[var(--fg-primary)]";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className={shellClass}>
      <DocsChromeHeader />
      {children}
    </div>
  );
}
