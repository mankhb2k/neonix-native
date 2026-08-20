"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site/SiteHeader";

export function DocsChromeHeader() {
  const pathname = usePathname();
  const active = pathname.startsWith("/docs/preview") ? "preview" : "docs";
  return <SiteHeader active={active} />;
}
