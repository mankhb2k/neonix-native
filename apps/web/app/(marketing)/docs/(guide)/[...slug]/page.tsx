import { notFound } from "next/navigation";
import {
  DOCS_PAGE_SLUGS,
  getDocsBreadcrumb,
  getDocsLastModified,
  getDocsPage,
  type DocsPageSlug,
} from "@/lib/docs/docs";
import { DocsArticle } from "../../_components/DocsArticle";
import type { Metadata } from "next";

const SITE_URL = "https://www.neonix.video";

export function generateStaticParams() {
  return DOCS_PAGE_SLUGS.filter((slug) => slug !== "").map((slug) => ({
    slug: slug.split("/"),
  }));
}

function slugFromParams(slug: string[] | undefined): DocsPageSlug | null {
  const joined = (slug ?? []).join("/");
  if ((DOCS_PAGE_SLUGS as readonly string[]).includes(joined)) {
    return joined;
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
    title: page.title,
    description: page.description,
    alternates: { canonical: `/docs/${key}` },
  };
}

function techArticleJsonLd(key: DocsPageSlug, page: { title: string; description?: string }) {
  const url = `${SITE_URL}/docs/${key}`;
  const breadcrumb = getDocsBreadcrumb(key);
  const lastModified = getDocsLastModified(key);
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: page.title,
    description: page.description,
    url,
    isPartOf: { "@type": "WebSite", name: "Neonix", url: SITE_URL },
    about: { "@type": "SoftwareApplication", name: "Neonix" },
    ...(lastModified ? { dateModified: lastModified.toISOString() } : {}),
    ...(breadcrumb.length > 0
      ? {
          breadcrumb: {
            "@type": "BreadcrumbList",
            itemListElement: breadcrumb.map((item, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: item.name,
              item: `${SITE_URL}${item.href}`,
            })),
          },
        }
      : {}),
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
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(techArticleJsonLd(key, page)),
        }}
      />
      <DocsArticle
        toc={page.toc}
        showToc={page.showToc}
        previewProject={page.previewProject}
      >
        {page.body}
      </DocsArticle>
    </>
  );
}
