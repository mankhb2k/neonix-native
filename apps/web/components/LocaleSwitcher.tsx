"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { locales, type Locale } from "@/i18n/locales";

const localeNames: Record<Locale, string> = {
  en: "English",
  vi: "Tiếng Việt",
};

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={locale}
      disabled={isPending}
      aria-label="Language"
      onChange={(event) => {
        const next = event.target.value as Locale;
        startTransition(() => {
          void setLocale(next);
        });
      }}
      className={
        className ??
        "w-full rounded-lg border border-[var(--hub-border)] bg-transparent px-2 py-1.5 text-caption text-[var(--fg-secondary)]"
      }
    >
      {locales.map((value) => (
        <option key={value} value={value}>
          {localeNames[value]}
        </option>
      ))}
    </select>
  );
}
