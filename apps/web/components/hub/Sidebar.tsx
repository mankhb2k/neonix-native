"use client";

import {
  Boxes,
  Download,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Settings,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { dashboardHref } from "@/components/AppLink";
import { getCurrentAccount } from "@/lib/api/session";
import { getStorageUsage, type StorageUsage } from "@/lib/api/storage";

const navItems = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "projects", href: "/dashboard/projects", icon: FolderKanban },
  { key: "assets", href: "/dashboard/assets", icon: Boxes },
  { key: "exports", href: "/dashboard/exports", icon: Download },
  { key: "api", href: "/dashboard/api", icon: KeyRound },
  { key: "topup", href: "/dashboard/topup", icon: Wallet },
  { key: "settings", href: "/dashboard/settings", icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  // "/dashboard" is a literal path prefix of every other dashboard route
  // (e.g. "/dashboard/assets"), so it must match exactly or every sub-page
  // would also highlight the Dashboard nav item.
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({
  item,
  pathname,
}: {
  item: (typeof navItems)[number];
  pathname: string;
}) {
  const t = useTranslations("Sidebar.nav");
  const Icon = item.icon;
  const active = isActive(pathname, item.href);

  return (
    <Link
      href={dashboardHref(item.href)}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium no-underline transition ${active ? "bg-[var(--hub-active)] text-[var(--fg-primary)]" : "text-[var(--fg-muted)] hover:bg-[var(--hub-hover)] hover:text-[var(--fg-primary)]"}`}
    >
      <Icon className={`size-4 ${active ? "text-[var(--hub-accent)]" : ""}`} />
      {t(item.key)}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("Sidebar");
  const [account, setAccount] = useState({
    name: "Your account",
    email: "Free plan",
  });
  const [storage, setStorage] = useState<StorageUsage | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAccount() {
      const current = await getCurrentAccount();
      if (!mounted) return;
      if (current) {
        setAccount({
          name: current.name || current.email,
          email: current.email,
        });
      }
    }

    async function loadStorage() {
      const usage = await getStorageUsage();
      if (mounted && usage) setStorage(usage);
    }

    const handleDemoAuth = () => {
      void loadAccount();
      void loadStorage();
    };

    void loadAccount();
    void loadStorage();
    window.addEventListener("neonix:dev-demo-authenticated", handleDemoAuth);
    return () => {
      mounted = false;
      window.removeEventListener("neonix:dev-demo-authenticated", handleDemoAuth);
    };
  }, []);

  return (
    <aside className="sticky top-0 row-span-1 hidden h-screen w-[var(--hub-sidebar-w)] min-w-0 flex-col overflow-y-auto border-r border-[var(--hub-border)] bg-[var(--hub-sidebar-bg)] lg:flex">
      <nav className="flex-1 space-y-1 px-3 py-5" aria-label={t("nav.ariaLabel")}>
        <div className="-mx-3 mb-5 border-b border-[var(--hub-border)] px-5 pb-5">
          <Link
            href={dashboardHref()}
            className="flex items-center gap-3 rounded-lg px-0 py-1 no-underline"
          >
            <Image
              src="/neonix-logo.svg"
              alt=""
              width={38}
              height={28}
              priority
              className="h-7 w-auto"
            />
            <span className="text-lg font-semibold tracking-[-0.03em] text-[var(--fg-primary)] [font-family:var(--font-display)]">
              Neonix
            </span>
          </Link>
        </div>

        <div className="mb-5 border-b border-[var(--hub-border)] pb-5">
          <p className="mb-2 px-3 text-sm font-semibold tracking-[0.14em] text-[var(--fg-disabled)] uppercase">
            {t("sections.workspace")}
          </p>
          {navItems.slice(0, 4).map((item) => (
            <NavItem key={item.key} item={item} pathname={pathname} />
          ))}
        </div>

        <div className="mb-5 border-b border-[var(--hub-border)] pb-5">
          <p className="mb-2 px-3 text-sm font-semibold tracking-[0.14em] text-[var(--fg-disabled)] uppercase">
            {t("sections.connect")}
          </p>
          {navItems.slice(4, 5).map((item) => (
            <NavItem key={item.key} item={item} pathname={pathname} />
          ))}
        </div>

        <p className="mb-2 px-3 text-sm font-semibold tracking-[0.14em] text-[var(--fg-disabled)] uppercase">
          {t("sections.account")}
        </p>
        {navItems.slice(5).map((item) => (
          <NavItem key={item.key} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="space-y-4 border-t border-[var(--hub-border)] p-4">
        {storage ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--fg-muted)]">{t("storage.label")}</span>
              <span className="font-mono text-[var(--fg-secondary)]">
                {formatBytes(storage.usedBytes)} / {formatBytes(storage.quotaBytes)}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-[var(--hub-divider)]"
              role="progressbar"
              aria-label={t("storage.ariaLabel")}
              aria-valuemin={0}
              aria-valuemax={storage.quotaBytes}
              aria-valuenow={storage.usedBytes}
            >
              <div
                className="h-full rounded-full bg-[var(--hub-accent)] transition-[width]"
                style={{ width: `${storage.usedPercent}%` }}
              />
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-[var(--hub-hover)]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-base font-semibold text-[var(--hub-accent)]">
            {account.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-base font-medium text-[var(--fg-primary)]">{account.name}</span>
              <span className="inline-flex shrink-0 items-center rounded border border-[var(--hub-accent)]/30 bg-[var(--accent-soft)] px-1 py-0.5 text-[9px] font-semibold leading-none tracking-[0.06em] text-[var(--hub-accent)]">
                FREE
              </span>
            </span>
            <span className="mt-0.5 block truncate text-sm text-[var(--fg-muted)]">{account.email}</span>
          </span>
          <LogOut className="size-3.5 text-[var(--fg-disabled)]" />
        </button>
      </div>
    </aside>
  );
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** unitIndex;
  const decimals = unitIndex === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}
