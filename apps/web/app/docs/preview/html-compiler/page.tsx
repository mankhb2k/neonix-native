import { readFile } from "node:fs/promises";
import path from "node:path";
import { Suspense } from "react";
import { HtmlCompilerRuntimeLab } from "@/components/docs/HtmlCompilerRuntimeLab";
import { HTML_COMPILER_FIXTURE_ROOT, type CategorizedHtmlCompilerPreviewCase } from "@/lib/docs/html-compiler-preview";
import type { HtmlCssComposition } from "@motionvideo/html-compiler";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HTML compiler preview lab",
  description: "HTML/CSS compiler output compared with the Neonix JSON V2 runtime.",
  robots: { index: false, follow: false },
};

const exportSamples = [
  { id: "html-compiler.export.marketing-launch", label: "Marketing launch / 10s", file: "marketing-launch.html", hint: "A dark product launch composition with staggered text, a CTA card, and a progress line." },
  { id: "html-compiler.export.product-story", label: "Product story / 10s", file: "product-story.html", hint: "A light product story composition comparing the authored browser layout with the compiled motion output." },
  { id: "html-compiler.export.creative-brand", label: "Creative brand / 10s", file: "creative-brand.html", hint: "A high-energy creative brand composition with typography, geometric shapes, motion paths, and depth cards." },
] as const;

function repoRoot() {
  const cwd = process.cwd().replace(/\\/g, "/");
  return cwd.endsWith("/apps/web") ? path.resolve(process.cwd(), "../..") : process.cwd();
}

function compositionFromDocument(html: string) {
  const content = html.match(/<meta[^>]+name=["']neonix-document["'][^>]+content='([^']+)'/i)?.[1];
  if (!content) throw new Error("Export sample is missing the neonix-document metadata.");
  const document = JSON.parse(content) as { composition: HtmlCssComposition };
  return document.composition;
}

async function loadExportSamples(): Promise<CategorizedHtmlCompilerPreviewCase[]> {
  return Promise.all(exportSamples.map(async (sample) => {
    const html = await readFile(
      path.join(repoRoot(), "apps/web/public/docs/html-compiler/fixtures", sample.file),
      "utf8",
    );
    return {
      id: sample.id,
      phase: "P9" as const,
      category: "Motion export samples" as const,
      classification: "combined" as const,
      classificationLabel: "10-second export",
      topic: "Motion & animation" as const,
      label: sample.label,
      properties: ["10 seconds", "30 fps", "HTML/CSS", "JSON V2", "Native export"],
      hint: sample.hint,
      durationMs: 10_000,
      composition: compositionFromDocument(html),
      fixtureUrl: `${HTML_COMPILER_FIXTURE_ROOT}/${sample.file}`,
    };
  }));
}

export default async function HtmlCompilerPreviewPage() {
  const samples = await loadExportSamples();
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-[13px] text-slate-400">
          Loading HTML compiler preview lab...
        </div>
      }
    >
      <HtmlCompilerRuntimeLab additionalCases={samples} />
    </Suspense>
  );
}
