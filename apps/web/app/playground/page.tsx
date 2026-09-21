import { Suspense } from "react";
import { HtmlCompilerPlayground } from "@/components/playground/HtmlCompilerPlayground";
import { SiteHeader } from "@/components/site/SiteHeader";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Convert HTML to Video Online",
  description:
    "Convert HTML and CSS into video instantly. Paste or upload your HTML, click Convert, and preview the animated result live in your browser — free, no signup required.",
  alternates: { canonical: "/playground" },
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
