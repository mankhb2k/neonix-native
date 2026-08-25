import Image from "next/image";
import Link from "next/link";
import { SiteNavButton } from "@/components/site/SiteNavButton";
import { buttonClassName } from "@/components/ui";
import { APP_NAME } from "@/lib/app-config";
import { appUrl } from "@/lib/hosts";
import { SITE_HEADER_HEIGHT, SITE_HEADER_SHELL_X } from "@/lib/site-shell";

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
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/login"
            className={buttonClassName({
              variant: "ghost",
              size: "md",
              className: "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]",
            })}
          >
            Log in
          </Link>
          <Link
            href="/register"
            className={buttonClassName({
              variant: "primary",
              size: "md",
              className: "hidden sm:inline-flex",
            })}
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}
