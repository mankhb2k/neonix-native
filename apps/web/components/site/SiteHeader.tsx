"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteNavButton } from "@/components/site/SiteNavButton";
import { buttonClassName } from "@/components/ui";
import { APP_NAME } from "@/lib/app-config";
import { dashboardUrl } from "@/lib/hosts";
import { SITE_HEADER_HEIGHT, SITE_HEADER_SHELL_X } from "@/lib/site-shell";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const headerOuterClass =
  "sticky top-0 z-20 border-b border-[var(--border-subtle,#e4e4e7)] bg-[color-mix(in_srgb,var(--bg-site)_90%,transparent)] backdrop-blur";

export function SiteHeader({
  active,
}: {
  active?: "docs" | "home" | "mcp";
}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const isDevelopment = process.env.NODE_ENV !== "production";

  useEffect(() => {
    if (isDevelopment) return undefined;

    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      setIsAuthenticated(false);
      return undefined;
    }

    void supabase.auth
      .getSession()
      .then(({ data }) => setIsAuthenticated(Boolean(data.session)));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
    });

    return () => subscription.unsubscribe();
  }, [isDevelopment]);

  const showDashboard = isDevelopment || isAuthenticated === true;
  const showAuthActions = isDevelopment || isAuthenticated === false;

  return (
    <header className={headerOuterClass}>
      <div className={SITE_HEADER_SHELL_X}>
        <div
          className={`grid ${SITE_HEADER_HEIGHT} grid-cols-[1fr_auto_1fr] items-center gap-3`}
        >
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center gap-4 no-underline"
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
        <nav className="flex items-center justify-self-center gap-6">
          <SiteNavButton href="/" active={active === "home"}>
            Home
          </SiteNavButton>
          <SiteNavButton href="/docs" active={active === "docs"}>
            Docs
          </SiteNavButton>
          <SiteNavButton href="/docs/ai" active={active === "mcp"}>
            MCP
          </SiteNavButton>
        </nav>
        <div className="flex items-center justify-self-end gap-2">
          {showDashboard ? (
            <a
              href={dashboardUrl("/dashboard")}
              className={buttonClassName({ variant: "secondary", size: "md" })}
            >
              Dashboard
            </a>
          ) : null}
          {showAuthActions ? (
            <>
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
            </>
          ) : null}
        </div>
        </div>
      </div>
    </header>
  );
}
