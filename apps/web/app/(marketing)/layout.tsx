import { SiteHeader } from "@/components/site/SiteHeader";
import type { ReactNode } from "react";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader active="home" />
      {children}
    </>
  );
}
