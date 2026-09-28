"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export const MARKETING_TYPOGRAPHY = {
  eyebrow: "text-xs",
  heading: "text-4xl sm:text-6xl",
  lead: "text-lg",
  cardTitle: "text-xl",
  body: "text-base",
  codeMeta: "text-xs",
  code: "text-sm",
} as const;

export function Reveal({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (
      !element ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function Section({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`mx-auto w-full max-w-[1200px] px-6 py-20 sm:py-28 ${className}`}
    >
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p
      className={`text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]`}
      style={{ fontFamily: "var(--font-noto-sans)" }}
    >
      {children}
    </p>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <h2
      className={`mt-3 max-w-3xl font-semibold leading-tight tracking-[-0.025em] text-[var(--fg-primary)] ${MARKETING_TYPOGRAPHY.heading}`}
    >
      {children}
    </h2>
  );
}

export function MarketingButton({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <a
      href={href}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-base font-semibold no-underline transition ${secondary ? "border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--fg-primary)] hover:border-[var(--accent)]" : "border-transparent bg-[var(--accent)] text-[var(--accent-on)] shadow-sm hover:bg-[var(--accent-hover)]"}`}
    >
      {children}
    </a>
  );
}
