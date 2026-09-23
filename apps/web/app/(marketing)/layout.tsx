import { MarketingChromeHeader } from "@/components/site/MarketingChromeHeader";
import type { ReactNode } from "react";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingChromeHeader />
      {children}
    </>
  );
}
