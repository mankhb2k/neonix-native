"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SiteNavButton } from "@/components/site/SiteNavButton";
import { buttonClassName } from "@/components/ui";
import { APP_NAME } from "@/lib/app-config";
import { apiUrl } from "@/lib/api/client";
import { dashboardUrl } from "@/lib/hosts";
import { SITE_HEADER_HEIGHT, SITE_HEADER_SHELL_X } from "@/lib/site-shell";

const headerOuterClass =
  "sticky top-0 z-20 border-b border-[var(--border-subtle,#e4e4e7)] bg-[color-mix(in_srgb,var(--bg-site)_90%,transparent)] backdrop-blur";

export function SiteHeader({
  active,
}: {
  active?: "docs" | "mcp" | "playground" | "templates";
}) {
  const t = useTranslations("SiteHeader");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [devSigningIn, setDevSigningIn] = useState(false);
  const [devSignInError, setDevSignInError] = useState<string | null>(null);
  const isDevelopment = process.env.NODE_ENV !== "production";

  useEffect(() => {
    if (isDevelopment) return;
    // Show signed-out navigation until account actions are connected to apps/api.
    setIsAuthenticated(false);
  }, [isDevelopment]);

  const showDashboard = isDevelopment || isAuthenticated === true;
  const showAuthActions = isDevelopment || isAuthenticated === false;

  async function openDevDashboard(): Promise<void> {
    setDevSigningIn(true);
    setDevSignInError(null);
    try {
      const response = await fetch(apiUrl("/api/auth/sign-in/email"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: process.env.NEXT_PUBLIC_DEV_DEMO_EMAIL ?? "demo@gmail.com",
          password: process.env.NEXT_PUBLIC_DEV_DEMO_PASSWORD ?? "demo123@",
        }),
      });
      if (!response.ok) {
        throw new Error(`Demo sign-in failed (${response.status}).`);
      }
      window.location.assign(dashboardUrl("/dashboard"));
    } catch (error) {
      setDevSigningIn(false);
      setDevSignInError(error instanceof Error ? error.message : "Demo sign-in failed.");
    }
  }

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
          <SiteNavButton href="/docs" active={active === "docs"}>
            {t("nav.docs")}
          </SiteNavButton>
          <SiteNavButton href="/templates" active={active === "templates"}>
            {t("nav.templates")}
          </SiteNavButton>
          <SiteNavButton href="/docs/mcp" active={active === "mcp"}>
            {t("nav.mcp")}
          </SiteNavButton>
          <SiteNavButton href="/playground" active={active === "playground"}>
            {t("nav.playground")}
          </SiteNavButton>
        </nav>
        <div className="flex items-center justify-self-end gap-2">
          <LocaleSwitcher iconOnly align="end" />
          {showDashboard ? (
            <a
              href={dashboardUrl("/dashboard")}
              onClick={(event) => {
                if (!isDevelopment) return;
                event.preventDefault();
                if (!devSigningIn) void openDevDashboard();
              }}
              aria-busy={devSigningIn}
              className={buttonClassName({ variant: "secondary", size: "lg" })}
            >
              {devSigningIn ? "Signing in…" : t("actions.dashboard")}
            </a>
          ) : null}
          {showAuthActions ? (
            <>
              <Link
                href="/login"
                className={buttonClassName({
                  variant: "ghost",
                  size: "lg",
                  className: "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]",
                })}
              >
                {t("actions.login")}
              </Link>
              <Link
                href="/register"
                className={buttonClassName({
                  variant: "primary",
                  size: "lg",
                  className: "hidden sm:inline-flex",
                })}
              >
                {t("actions.signUp")}
              </Link>
            </>
          ) : null}
        </div>
        {devSignInError ? <p className="mt-1 text-right text-xs text-red-600">{devSignInError}</p> : null}
        </div>
      </div>
    </header>
  );
}
