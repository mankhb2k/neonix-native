import Image from "next/image";
import Link from "next/link";
import { APP_NAME } from "@/lib/app-config";
import { appUrl } from "@/lib/hosts";
import { SITE_HEADER_HEIGHT, SITE_HEADER_SHELL_X } from "@/lib/site-shell";
import { SiteNavButton } from "@/components/site/SiteNavButton";

const headerOuterClass =
  "sticky top-0 z-20 border-b border-[var(--border-subtle,#e4e4e7)] bg-[color-mix(in_srgb,var(--bg-site)_90%,transparent)] backdrop-blur";

export function SiteHeader({
  active,
}: {
  active?: "docs" | "app" | "home" | "preview";
}) {
  return (
    <header className={headerOuterClass}>
      <div
        className={`flex ${SITE_HEADER_HEIGHT} items-center gap-3 ${SITE_HEADER_SHELL_X}`}
      >
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-4 no-underline"
            aria-label={APP_NAME}
          >
            <Image
              src="/neonix-logo.svg"
              alt=""
              width={95}
              height={70}
              priority
              className="h-7 w-auto"
            />
            <span className="text-[15px] font-semibold tracking-tight text-[var(--fg-primary)]">
              {APP_NAME}
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <SiteNavButton href="/" active={active === "home"}>
              Home
            </SiteNavButton>
            <SiteNavButton href="/docs" active={active === "docs"}>
              Docs
            </SiteNavButton>
            <SiteNavButton
              href="/docs/preview"
              active={active === "preview"}
            >
              Preview
            </SiteNavButton>
            <SiteNavButton
              href={appUrl("/")}
              active={active === "app"}
              external
            >
              App
            </SiteNavButton>
          </nav>
        </div>
        <span className="ml-auto hidden rounded-lg border border-[var(--border-subtle,#e4e4e7)] px-3 py-1 text-[12px] text-[var(--fg-muted)] sm:inline">
          Search (Ctrl K) — soon
        </span>
      </div>
    </header>
  );
}
