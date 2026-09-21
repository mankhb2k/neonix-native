import { RadialPatternNativeLab } from "@/components/playground/RadialPatternNativeLab";
import { SiteHeader } from "@/components/site/SiteHeader";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Native stage debug",
  description: "Compare Browser CSS and native repeat and grid patterns in the 1920 by 1080 stage.",
  robots: { index: false, follow: false },
};

export default function NativeStagePage() {
  return (
    <>
      <SiteHeader active="playground" />
      <RadialPatternNativeLab />
    </>
  );
}
