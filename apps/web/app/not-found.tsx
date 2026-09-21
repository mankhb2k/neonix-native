import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { buttonClassName } from "@/components/ui";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-site)] px-6 py-24 text-center text-[var(--fg-primary)]">
      <Image
        src="/neonix-logo.svg"
        alt="Neonix"
        width={95}
        height={70}
        className="h-8 w-auto"
      />
      <p className="mt-8 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">
        404
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
        This page doesn&apos;t exist.
      </h1>
      <p className="mx-auto mt-4 max-w-md text-[var(--fg-secondary)]">
        The page you're looking for was moved, renamed, or never existed.
        Here are a few places to go instead.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClassName({ variant: "primary", size: "lg" })}>
          Go to homepage
        </Link>
        <Link
          href="/html-to-video"
          className={buttonClassName({ variant: "outline", size: "lg" })}
        >
          HTML to motion video
        </Link>
        <Link href="/docs" className={buttonClassName({ variant: "outline", size: "lg" })}>
          Docs
        </Link>
        <Link
          href="/support"
          className={buttonClassName({ variant: "outline", size: "lg" })}
        >
          Support
        </Link>
      </div>
    </main>
  );
}
