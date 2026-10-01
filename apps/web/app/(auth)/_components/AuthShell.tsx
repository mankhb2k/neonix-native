"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/** Shared split-card layout for every (auth) page: login, register, MCP sign-in and consent. */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations("AuthPage");

  return (
    <main className="min-h-screen bg-[var(--bg-site)] px-4 py-5 text-[var(--fg-primary)] sm:px-8 sm:py-8">
      <div
        data-testid="auth-card"
        className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-[1180px] overflow-hidden rounded-[28px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[0_24px_80px_rgba(23,23,23,0.08)] lg:min-h-[720px] lg:grid-cols-[1.08fr_0.92fr]"
      >
        <section className="relative hidden overflow-hidden bg-[#0b2530] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute -right-24 -top-24 size-80 rounded-full border border-[#65c4ed]/30 bg-[#65c4ed]/10 blur-sm" />
          <div className="absolute -bottom-36 -left-28 size-96 rounded-full border border-[#16b8a8]/30 bg-[#16b8a8]/10" />
          <div className="relative">
            <Link href="/" className="inline-flex items-center gap-3 no-underline">
              <Image src="/neonix-logo.svg" alt="Neonix" width={54} height={40} className="h-9 w-auto" priority />
              <span className="text-xl font-semibold tracking-[-0.03em]">Neonix</span>
            </Link>
            <p className="mt-24 max-w-md text-sm font-semibold uppercase tracking-[0.2em] text-[#65c4ed]">{t("eyebrow")}</p>
            <h2 className="mt-5 max-w-xl font-[var(--font-display)] text-5xl leading-[1.05] tracking-[-0.045em] xl:text-6xl">{t("panelTitle")}</h2>
            <p className="mt-7 max-w-lg text-base leading-7 text-white/70">{t("panelDescription")}</p>
          </div>
          <p className="relative max-w-sm text-sm leading-6 text-white/50">{t("panelFooter")}</p>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-12 lg:px-14 xl:px-20">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <Link href="/" className="inline-flex items-center gap-3 no-underline">
                <Image src="/neonix-logo.svg" alt="Neonix" width={48} height={36} className="h-8 w-auto" priority />
                <span className="text-xl font-semibold tracking-[-0.03em]">Neonix</span>
              </Link>
            </div>
{children}
          </div>
        </section>
      </div>
    </main>
  );
}
