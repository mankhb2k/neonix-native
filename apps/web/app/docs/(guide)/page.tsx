import { DocsArticle } from "@/components/docs/DocsArticle";
import { getDocsPage } from "@/lib/docs/page-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NeonVideo documentation",
  description:
    "Learn NeonVideo authoring, layers, animation, compositing, effects, and examples.",
};

export default function DocsIndexPage() {
  const page = getDocsPage("");
  return (
    <DocsArticle
      toc={page.toc}
      showToc={page.showToc}
      previewProject={page.previewProject}
    >
      {page.body}
    </DocsArticle>
  );
}
