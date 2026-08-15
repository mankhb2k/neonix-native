import type { ReactNode } from "react";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { SiteHeader } from "@/components/site/SiteHeader";

const shellClass = "min-h-screen bg-[var(--bg-site)] text-[var(--fg-primary)]";
const gridClass =
  "mx-auto grid w-full grid-cols-1 md:grid-cols-[20rem_minmax(0,1fr)]";
const mobileNavClass =
  "border-b border-[var(--border-subtle,#e4e4e7)] px-4 py-3 md:hidden";
const desktopNavClass =
  "sticky top-14 hidden h-[calc(100vh-3.5rem)] w-80 self-start overflow-y-auto px-6 py-8 md:block";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className={shellClass}>
      <SiteHeader active="docs" />
      <div className="px-4 xl:px-[14rem]">
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
    </div>
  );
}
