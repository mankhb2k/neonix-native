import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClassName } from "@/components/ui";

type SiteNavButtonProps = {
  href: string;
  active?: boolean;
  external?: boolean;
  children: ReactNode;
};

export function SiteNavButton({
  href,
  active = false,
  external = false,
  children,
}: SiteNavButtonProps) {
  const className = buttonClassName({
    variant: "nav",
    size: "lg",
    className: active
      ? "text-[var(--accent-text,#0f766e)]"
      : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]",
  });

  if (external) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
