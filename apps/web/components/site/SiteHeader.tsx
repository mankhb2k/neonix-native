import Link from "next/link";
import { APP_NAME } from "@/lib/app-config";
import { appUrl } from "@/lib/hosts";

const headerClass =
  "sticky top-0 z-20 flex h-14 items-center gap-6 border-b border-[var(--border-subtle,#e4e4e7)] bg-[color-mix(in_srgb,var(--bg-site)_90%,transparent)] px-4 backdrop-blur";

export function SiteHeader({
  active,
}: {
  active?: "docs" | "app" | "home";
}) {
  const navClass = (id: typeof active) =>
    `text-[13px] font-medium no-underline ${
      active === id
        ? "text-[var(--accent-text,#0f766e)]"
        : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
    }`;

  return (
    <header className={headerClass}>
      <Link
        href="/"
        className="font-semibold text-[var(--fg-primary)] no-underline"
      >
        {APP_NAME}
      </Link>
      <Link href="/docs" className={navClass("docs")}>
        Docs
      </Link>
      <a href={appUrl("/")} className={navClass("app")}>
        App
      </a>
      <span className="ml-auto hidden rounded-lg border border-[var(--border-subtle,#e4e4e7)] px-3 py-1 text-[12px] text-[var(--fg-muted)] sm:inline">
        Search (Ctrl K) — soon
      </span>
    </header>
  );
}
