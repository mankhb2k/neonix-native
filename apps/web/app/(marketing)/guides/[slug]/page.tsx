import { notFound } from "next/navigation";
import { GuideCard } from "@/components/guides/GuideCard";
import { getGuideLastModified, getGuidePage, getGuideSlugs, listGuides } from "@/lib/guides/guides";
import type { Metadata } from "next";

const SITE_URL = "https://www.neonix.video";

export function generateStaticParams() {
  return getGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuidePage(slug);
  if (!guide) return { title: "Not found" };
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guides/${slug}` },
  };
}

function howToJsonLd(slug: string, guide: { title: string; description: string }, lastModified: Date | null) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: guide.title,
    description: guide.description,
    url: `${SITE_URL}/guides/${slug}`,
    isPartOf: { "@type": "WebSite", name: "Neonix", url: SITE_URL },
    about: { "@type": "SoftwareApplication", name: "Neonix" },
    ...(lastModified ? { dateModified: lastModified.toISOString() } : {}),
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuidePage(slug);
  if (!guide) notFound();
  const related = listGuides()
    .filter((item) => item.slug !== slug)
    .slice(0, 3);
  const lastModified = getGuideLastModified(slug);

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[var(--bg-site)] text-[var(--fg-primary)]">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd(slug, guide, lastModified)) }}
      />

      <div className="px-6 pt-16 sm:pt-24">{guide.body}</div>

      {related.length > 0 ? (
        <div className="mx-auto max-w-[900px] px-6 pb-20">
          <section className="border-t border-[var(--border-subtle)] pt-10">
            <h2 className="text-xl font-semibold text-[var(--fg-primary)]">More guides</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {related.map((item) => (
                <GuideCard key={item.slug} guide={item} />
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
