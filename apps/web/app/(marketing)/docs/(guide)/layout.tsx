import { DocsSidebar } from "../_components/DocsSidebar";
import type { ReactNode } from "react";

const gridClass =
  "mx-auto grid w-full max-w-[1440px] grid-cols-1 md:grid-cols-[20rem_minmax(0,1fr)]";
const mobileNavClass =
  "border-b border-[var(--border-subtle,#e4e4e7)] bg-[var(--bg-surface)] px-4 py-3 md:hidden";
const desktopNavClass =
  "docs-sidebar-scroll sticky top-16 hidden h-[calc(100vh-4rem)] self-start overflow-y-auto border-r border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--bg-surface)_55%,transparent)] px-5 py-8 md:block xl:px-6";

export default function DocsGuideLayout({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-[var(--border-subtle)] px-4 md:px-6 xl:px-8">
      <div className={gridClass}>
        <aside className={mobileNavClass}>
          <details>
            <summary className="cursor-pointer text-[13px] font-medium">
              Docs menu
            </summary>
            <DocsSidebar />
          </details>
        </aside>
        <aside className={desktopNavClass}>
          <DocsSidebar />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
