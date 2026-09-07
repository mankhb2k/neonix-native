import { DocsPreview } from "@/components/docs/DocsPreview";
import { DocsToc } from "@/components/docs/DocsToc";

const asideClass =
  "sticky top-16 hidden max-h-[calc(100vh-4rem)] overflow-y-auto border-l border-[var(--border-subtle)] px-5 py-10 xl:block xl:justify-self-start";

export function DocsOnThisPage({
  items,
  previewProject,
}: {
  items?: Array<{ id: string; title: string }>;
  previewProject?: unknown;
}) {
  const toc = items && items.length > 0 ? items : undefined;
  if (!toc && !previewProject) return null;

  return (
    <aside className={asideClass}>
      {toc ? <DocsToc items={toc} /> : null}
      {previewProject ? (
        <div className={toc ? "mt-8" : undefined}>
        <DocsPreview project={previewProject} />
        </div>
      ) : null}
    </aside>
  );
}
