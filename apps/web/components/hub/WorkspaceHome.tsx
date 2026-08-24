import Link from "next/link";
import { appHref } from "@/components/AppLink";
import { marketingUrl } from "@/lib/hosts";

const hubBg =
  "[background:radial-gradient(ellipse_70%_45%_at_12%_-8%,rgba(34,211,238,0.1)_0%,transparent_55%),radial-gradient(ellipse_55%_40%_at_92%_8%,rgba(168,85,255,0.08)_0%,transparent_50%),var(--bg-site)]";

/** V2-only workspace entrypoint. It intentionally has no legacy editor imports. */
export function WorkspaceHome() {
  return (
    <main className={`min-h-screen text-[var(--fg-primary)] ${hubBg}`}>
      <header className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4 backdrop-blur-[10px] [background:color-mix(in_srgb,var(--bg-editor)_88%,transparent)]">
        <Link
          href={marketingUrl("/")}
          className="font-semibold tracking-[-0.02em] text-[var(--fg-primary)] no-underline [font-family:var(--font-display)]"
        >
          NeonVideo
        </Link>
        <a
          href={marketingUrl("/")}
          className="text-sm text-[var(--fg-muted)] no-underline hover:text-[var(--fg-primary)]"
        >
          Landing
        </a>
      </header>

      <section className="mx-auto max-w-[960px] px-6 py-16">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-cyan-300 uppercase">
          Workspace · Protocol V2
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-[var(--fg-primary)]">
          Tạo và kiểm tra motion atom bằng pipeline V2.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--fg-muted)]">
          App và editor hiện chỉ nhận Atomic Protocol V2: schema strict, compiler V2,
          runtime Matrix4 và preview backend-neutral.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href={appHref("/editor/shape")}
            className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 p-5 no-underline transition hover:border-cyan-300/70"
          >
            <p className="text-sm font-semibold text-cyan-100">Mở V2 shape editor</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Một shape atom với transport và JSON Protocol V2.
            </p>
          </Link>
          <Link
            href={appHref("/editor/overlap")}
            className="rounded-lg border border-white/10 bg-white/[0.03] p-5 no-underline transition hover:border-white/30"
          >
            <p className="text-sm font-semibold text-slate-100">Mở V2 overlap editor</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Hai root atoms, zIndex deterministic và Matrix4 compositing.
            </p>
          </Link>
          <Link
            href={appHref("/editor/three-kingdoms")}
            className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-5 no-underline transition hover:border-amber-300/60"
          >
            <p className="text-sm font-semibold text-amber-100">
              Tam Quốc · lịch sử 60 giây
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Project V2 nhiều layer theo order, main lane và nhạc nền.
            </p>
          </Link>
        </div>

        <Link
          href="/docs/preview"
          className="mt-5 inline-flex text-sm font-medium text-cyan-300 underline"
        >
          Xem toàn bộ V2 preview lab →
        </Link>
      </section>
    </main>
  );
}
