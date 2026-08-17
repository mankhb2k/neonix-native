import { DocsArticle } from "@/components/docs/DocsArticle";
import { getDocsPage } from "@/lib/docs/page-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Motion JSON docs — NeonVideo",
  description: "Authoring law for MotionProjectV1: mental model, atoms, validation.",
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
