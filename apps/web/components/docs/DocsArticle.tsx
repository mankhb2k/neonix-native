import { DocsOnThisPage } from "@/components/docs/DocsOnThisPage";
import type { ReactNode } from "react";

const contentGridClass = "grid min-w-0 grid-cols-1 xl:grid-cols-[1fr_auto_1fr]";

export function DocsArticle({
  toc,
  showToc = false,
  previewProject,
  children,
}: {
  toc?: Array<{ id: string; title: string }>;
  showToc?: boolean;
  previewProject?: unknown;
  children: ReactNode;
}) {
  const hasRail =
    (showToc && toc && toc.length > 0) || previewProject != null;

  return (
    <div className={contentGridClass}>
      <div className="hidden xl:block" />
      <main className="w-full min-w-0 max-w-[68rem] px-5 py-10 md:px-8 xl:w-[68rem]">
        {children}
      </main>
      {hasRail ? (
        <DocsOnThisPage
          items={showToc ? toc : undefined}
          previewProject={previewProject}
        />
      ) : (
        <div className="hidden xl:block" />
      )}
    </div>
  );
}
