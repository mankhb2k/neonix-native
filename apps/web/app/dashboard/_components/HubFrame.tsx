import { Sidebar } from "./Sidebar";
import type { ReactNode } from "react";

export function HubFrame({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--hub-content-bg)] text-[var(--fg-primary)]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[var(--hub-sidebar-w)_minmax(0,1fr)]">
        <Sidebar />
        <div className="min-h-screen min-w-0 lg:col-start-2 lg:row-start-1">
          <section className="min-w-0 px-5 py-8 sm:px-8 lg:px-12 lg:py-10 xl:px-16 2xl:px-20">
            <div className="mx-auto w-full max-w-[1080px]">{children}</div>
          </section>
        </div>
      </div>
    </main>
  );
}
