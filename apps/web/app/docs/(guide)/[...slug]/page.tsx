import { notFound } from "next/navigation";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { DOCS_PAGE_SLUGS, getDocsPage, type DocsPageSlug } from "@/lib/docs/docs";
import type { Metadata } from "next";

export function generateStaticParams() {
  return DOCS_PAGE_SLUGS.filter((slug) => slug !== "").map((slug) => ({
    slug: slug.split("/"),
  }));
}

function slugFromParams(slug: string[] | undefined): DocsPageSlug | null {
  const joined = (slug ?? []).join("/");
  if ((DOCS_PAGE_SLUGS as readonly string[]).includes(joined)) {
    return joined as DocsPageSlug;
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const key = slugFromParams(slug);
  if (!key) return { title: "Not found" };
  const page = getDocsPage(key);
  return {
    title: `${page.title} — Motion JSON docs`,
  };
}

export default async function DocsSlugPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const key = slugFromParams(slug);
  if (!key) notFound();
  const page = getDocsPage(key);
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
