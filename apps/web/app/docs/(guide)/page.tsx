import { DocsArticle } from "@/components/docs/DocsArticle";
import { getDocsPage } from "@/lib/docs/page-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "V2 architecture - NeonVideo",
  description:
    "NeonVideo V2 pipeline from high-level authoring through Atomic Protocol, runtime, preview, and export.",
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
