"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_NAV } from "@/lib/docs/nav";

export function DocsSidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-8 pb-12 text-lg">
      {DOCS_NAV.map((group) => (
        <div key={group.id}>
          <p className="mb-3 text-[13px] font-semibold tracking-[0.14em] text-[var(--fg-muted)] uppercase">
            {group.label}
          </p>
          <ul className="border-l border-zinc-200">
            {group.items.map((item) => {
              const active = pathname === item.href;
              const pad = "block border-l py-1.5 pl-4 -ml-px no-underline";
              return (
                <li key={`${item.href}-${item.label}`}>
                  <Link
                    href={item.href}
                    className={
                      active
                        ? `${pad} border-zinc-900 font-semibold text-zinc-900`
                        : `${pad} border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-900`
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
