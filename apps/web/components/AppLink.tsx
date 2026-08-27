import Link from "next/link";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

/** Control-plane links stay on neonix.video. */
export function dashboardHref(path = "/dashboard"): string {
  if (path.startsWith("http")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/" ? "/dashboard" : normalized;
}

export function DashboardLink({ href, ...rest }: Props) {
  return <Link href={dashboardHref(href)} {...rest} />;
}
