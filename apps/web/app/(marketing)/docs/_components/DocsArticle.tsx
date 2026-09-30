import { DocsOnThisPage } from "./DocsOnThisPage";
import type { ReactNode } from "react";

const contentGridClass = "grid min-w-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_15rem]";

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
      <main className="w-full min-w-0 max-w-[60rem] justify-self-center px-5 py-10 md:px-8 xl:px-12 xl:py-12">
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
