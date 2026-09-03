import { Suspense } from "react";
import { HtmlCompilerRuntimeLab } from "@/components/docs/HtmlCompilerRuntimeLab";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HTML compiler preview lab",
  description: "HTML/CSS compiler output compared with the Protocol V2 runtime.",
  robots: { index: false, follow: false },
};

export default function HtmlCompilerPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-[13px] text-slate-400">
          Loading HTML compiler preview lab...
        </div>
      }
    >
      <HtmlCompilerRuntimeLab />
    </Suspense>
  );
}
