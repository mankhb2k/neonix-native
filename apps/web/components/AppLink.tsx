import Link from "next/link";
import type { ComponentProps } from "react";
import { APP_ROUTE_PREFIX } from "@/lib/hosts";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

/** Product links always target `/app/...` (subdomain middleware strips the prefix). */
export function appHref(path = "/"): string {
  if (path.startsWith("http")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (
    normalized === APP_ROUTE_PREFIX ||
    normalized.startsWith(`${APP_ROUTE_PREFIX}/`)
  ) {
    return normalized;
  }
  return normalized === "/"
    ? APP_ROUTE_PREFIX
    : `${APP_ROUTE_PREFIX}${normalized}`;
}

export function AppLink({ href, ...rest }: Props) {
  return <Link href={appHref(href)} {...rest} />;
}
