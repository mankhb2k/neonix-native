"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site/SiteHeader";

/**
 * Single header for every route under (marketing), including /docs and
 * /guides — rendered once from the group layout so its client chunk (and
 * the Supabase session check inside SiteHeader) is fetched once and shared
 * across every marketing page, instead of duplicated per page.
 */
export function MarketingChromeHeader() {
  const pathname = usePathname();
  const active = pathname.startsWith("/docs/mcp")
    ? "mcp"
    : pathname.startsWith("/docs")
      ? "docs"
      : pathname.startsWith("/guides")
        ? "guides"
        : undefined;
  return <SiteHeader active={active} />;
}
