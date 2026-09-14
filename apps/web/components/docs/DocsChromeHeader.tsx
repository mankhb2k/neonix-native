"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site/SiteHeader";

export function DocsChromeHeader() {
  const pathname = usePathname();
  return <SiteHeader active={pathname.startsWith("/docs/mcp") ? "mcp" : "docs"} />;
}
