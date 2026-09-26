import { ComparePreviewLab } from "@/components/playground/ComparePreviewLab";
import { SiteHeader } from "@/components/site/SiteHeader";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Native stage debug",
  description: "Compare browser CSS against the native Skia renderer at 1920x1080, using either the fixture library or custom pasted HTML, stacked 1:1 or scaled side by side.",
  robots: { index: false, follow: false },
};

export default function NativeStagePage() {
  return (
    <>
      <SiteHeader active="playground" />
      <ComparePreviewLab defaultMode="fixture" defaultLayout="side-by-side" />
    </>
  );
}
