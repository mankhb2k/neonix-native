"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_NAV } from "@/lib/docs/docs-nav";

export function DocsSidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-8 pb-12 text-body">
      {DOCS_NAV.map((group) => (
        <div key={group.id}>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-body font-semibold tracking-[-0.01em] text-[var(--fg-primary)]">
                {group.label}
              </p>
              {group.description ? (
                <p className="mt-1 text-body leading-6 text-[var(--fg-muted)]">
                  {group.description}
                </p>
              ) : null}
            </div>
            <span className="font-mono text-caption text-[var(--fg-muted)]">
              {String(group.items.length).padStart(2, "0")}
            </span>
          </div>
          <ul className="border-l border-[var(--border-subtle)]">
            {group.items.map((item) => {
              const active = pathname === item.href;
              const pad =
                "-ml-px block border-l py-2 pl-4 text-body leading-6 no-underline transition-colors";
              return (
                <li key={`${item.href}-${item.label}`}>
                  <Link
                    href={item.href}
                    className={
                      active
                        ? `${pad} rounded-r-md border-[var(--accent)] bg-[#e8f8f4] font-semibold text-[#087f73]`
                        : `${pad} border-transparent text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[#087f73]`
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
