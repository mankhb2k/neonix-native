import { DocsArticle } from "@/components/docs/DocsArticle";
import { getDocsPage } from "@/lib/docs/docs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Neonix documentation",
  description:
    "Learn Neonix authoring, layers, animation, compositing, effects, and examples.",
  alternates: { canonical: "/docs" },
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
