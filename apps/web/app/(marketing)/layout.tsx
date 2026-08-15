import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader active="home" />
      {children}
    </>
  );
}
