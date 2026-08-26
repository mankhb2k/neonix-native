import { Suspense } from "react";
import { PreviewLab } from "@/components/docs/PreviewLab";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Preview lab",
  description: "Protocol V2 atoms rendered one certified primitive at a time.",
  robots: { index: false, follow: false },
};

export default function PreviewLabPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-[13px] text-slate-400">
          Loading preview lab...
        </div>
      }
    >
      <PreviewLab />
    </Suspense>
  );
}
