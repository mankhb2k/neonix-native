import { Suspense } from "react";
import { HtmlCompilerPlayground } from "@/components/playground/HtmlCompilerPlayground";
import { SiteHeader } from "@/components/site/SiteHeader";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HTML compiler playground | Neonix",
  description: "Import HTML and compare browser CSS with the Neonix Runtime V3 and Skia preview.",
  robots: { index: false, follow: false },
};

export default function PlaygroundPage() {
  return (
    <>
      <SiteHeader active="playground" />
      <Suspense
        fallback={
          <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-[13px] text-slate-400">
            Loading HTML compiler playground...
          </div>
        }
      >
        <HtmlCompilerPlayground />
      </Suspense>
    </>
  );
}
