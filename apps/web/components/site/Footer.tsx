import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-site)]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="text-sm font-semibold tracking-[0.08em] text-[var(--fg-primary)]">
            NEONIX
          </Link>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            HTML and CSS authoring for structured motion video.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--fg-secondary)]">
          <Link className="transition-colors hover:text-[var(--fg-primary)]" href="/overview">
            Overview
          </Link>
          <Link className="transition-colors hover:text-[var(--fg-primary)]" href="/guides">
            Guides
          </Link>
          <Link className="transition-colors hover:text-[var(--fg-primary)]" href="/docs">
            Docs
          </Link>
          <Link className="transition-colors hover:text-[var(--fg-primary)]" href="/support">
            Support
          </Link>
          <Link className="transition-colors hover:text-[var(--fg-primary)]" href="/privacy">
            Privacy
          </Link>
          <Link className="transition-colors hover:text-[var(--fg-primary)]" href="/terms">
            Terms
          </Link>
          <a className="transition-colors hover:text-[var(--fg-primary)]" href="mailto:support@neonix.video">
            Contact
          </a>
        </nav>
      </div>
      <div className="border-t border-[var(--border-subtle)] px-6 py-4 text-center text-xs text-[var(--fg-muted)]">
        © {new Date().getFullYear()} Neonix. All rights reserved.
      </div>
    </footer>
  );
}
