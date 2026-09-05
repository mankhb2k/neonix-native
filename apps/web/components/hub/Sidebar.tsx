"use client";

import {
  Boxes,
  Download,
  LayoutDashboard,
  LogOut,
  Plug,
  Settings,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { dashboardHref } from "@/components/AppLink";
import { getStorageUsage, type StorageUsage } from "@/lib/api/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Assets", href: "/assets", icon: Boxes },
  { label: "Exports", href: "/exports", icon: Download },
  { label: "MCP", href: "/mcp", icon: Plug },
  // Temporarily hidden from the dashboard navigation:
  // { label: "API Keys", href: "/api-keys", icon: KeyRound },
  // { label: "Usage", href: "/usage", icon: Gauge },
  // { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({
  item,
  pathname,
}: {
  item: (typeof navItems)[number];
  pathname: string;
}) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);

  return (
    <Link
      href={dashboardHref(item.href)}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-body font-medium no-underline transition ${active ? "bg-[var(--hub-active)] text-[var(--fg-primary)]" : "text-[var(--fg-muted)] hover:bg-[var(--hub-hover)] hover:text-[var(--fg-primary)]"}`}
    >
      <Icon className={`size-4 ${active ? "text-[var(--hub-accent)]" : ""}`} />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [account, setAccount] = useState({
    name: "Your account",
    email: "Free plan",
  });
  const [storage, setStorage] = useState<StorageUsage | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAccount() {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!mounted || !user) return;

        const metadataName =
          typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
        const email = user.email ?? "";
        setAccount({
          name: metadataName || email.split("@")[0] || "Your account",
          email: email || "Free plan",
        });
      } catch {
        // Keep the safe placeholder when auth is unavailable during local boot.
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
      <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Workspace">
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
          <p className="mb-2 px-3 text-caption font-semibold tracking-[0.14em] text-[var(--fg-disabled)] uppercase">
            Workspace
          </p>
          {navItems.slice(0, 3).map((item) => (
            <NavItem key={item.label} item={item} pathname={pathname} />
          ))}
        </div>

        <div className="mb-5 border-b border-[var(--hub-border)] pb-5">
          <p className="mb-2 px-3 text-caption font-semibold tracking-[0.14em] text-[var(--fg-disabled)] uppercase">
            Connect
          </p>
          {navItems.slice(3, 4).map((item) => (
            <NavItem key={item.label} item={item} pathname={pathname} />
          ))}
        </div>

        <p className="mb-2 px-3 text-caption font-semibold tracking-[0.14em] text-[var(--fg-disabled)] uppercase">
          Account
        </p>
        {navItems.slice(4).map((item) => (
          <NavItem key={item.label} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="space-y-4 border-t border-[var(--hub-border)] p-4">
        {storage ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-caption">
              <span className="text-[var(--fg-muted)]">Storage</span>
              <span className="font-mono text-[var(--fg-secondary)]">
                {formatBytes(storage.usedBytes)} / {formatBytes(storage.quotaBytes)}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-[var(--hub-divider)]"
              role="progressbar"
              aria-label="Storage usage"
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
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-body font-semibold text-[var(--hub-accent)]">
            {account.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-body font-medium text-[var(--fg-primary)]">{account.name}</span>
              <span className="inline-flex shrink-0 items-center rounded border border-[var(--hub-accent)]/30 bg-[var(--accent-soft)] px-1 py-0.5 text-[9px] font-semibold leading-none tracking-[0.06em] text-[var(--hub-accent)]">
                FREE
              </span>
            </span>
            <span className="mt-0.5 block truncate text-caption text-[var(--fg-muted)]">{account.email}</span>
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
