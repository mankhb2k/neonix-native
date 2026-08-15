import { DocsToc } from "@/components/docs/DocsToc";
import { DocsPixiPreview } from "@/components/docs/DocsPixiPreview";

const asideClass =
  "sticky top-14 hidden max-h-[calc(100vh-3.5rem)] overflow-y-auto px-4 py-8 xl:block xl:justify-self-start";

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
          <DocsPixiPreview project={previewProject} />
        </div>
      ) : null}
    </aside>
  );
}
