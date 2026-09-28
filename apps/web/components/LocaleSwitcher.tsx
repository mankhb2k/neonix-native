"use client";

import { Check, ChevronDown, Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { Avatar, Button, Dropdown, type ButtonSize, type ButtonVariant } from "@/components/ui";
import { locales, type Locale } from "@/i18n/locales";
import { cn } from "@/lib/utils";

const localeNames: Record<Locale, string> = {
  en: "English",
  vi: "Tiếng Việt",
};

const localeAbbr: Record<Locale, string> = {
  en: "EN",
  vi: "VN",
};

export type LocaleSwitcherProps = {
  /** Circular flag-only trigger (e.g. the site header) instead of the labeled button. */
  iconOnly?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  align?: "start" | "end";
  triggerClassName?: string;
  menuClassName?: string;
};

export function LocaleSwitcher({
  iconOnly = false,
  variant = "outline",
  size = "lg",
  align = "end",
  triggerClassName,
  menuClassName,
}: LocaleSwitcherProps) {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const items = locales.map((value) => ({
    label: localeNames[value],
    trailingIcon: value === locale ? <Check className="size-4" /> : undefined,
    onSelect: () => {
      if (value === locale) return;
      startTransition(() => {
        void setLocale(value);
      });
    },
  }));

  if (iconOnly) {
    return (
      <Dropdown
        label="Language"
        align={align}
        menuClassName={menuClassName}
        trigger={
          <button
            type="button"
            disabled={isPending}
            aria-label="Language"
            className={cn(
              "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--border-strong)] p-0 transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40",
              triggerClassName,
            )}
          >
            <Avatar size="sm" className="size-8 bg-[var(--bg-hover)] text-[11px] font-semibold text-[var(--fg-primary)]">
              {localeAbbr[locale as Locale]}
            </Avatar>
          </button>
        }
        items={items}
      />
    );
  }

  return (
    <Dropdown
      label="Language"
      align={align}
      menuClassName={menuClassName}
      trigger={
        <Button
          variant={variant}
          size={size}
          disabled={isPending}
          aria-label="Language"
          className={triggerClassName}
        >
          <Languages className="size-4 shrink-0" />
          <span className="flex-1 text-left">{localeNames[locale as Locale]}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      }
      items={items}
    />
  );
}
