"use client";

import {
  ArrowRight,
  ChevronDown,
  Code2,
  Cpu,
  Gauge,
  Layers3,
  ListOrdered,
  Network,
  Play,
  Server,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Eyebrow,
  Heading,
  MarketingButton as Button,
  MARKETING_TYPOGRAPHY,
  Reveal,
  Section,
} from "./marketing-ui";
import type { ComponentType } from "react";

type FeatureCard = { title: string; description: string };

const SECTION_ICONS: Record<"infra" | "cost" | "stack", ComponentType<{ className?: string; strokeWidth?: number }>[]> = {
  infra: [Gauge, Network, Layers3],
  cost: [Workflow, ShieldCheck, Cpu],
  stack: [ListOrdered, Server, Code2],
};

function Hero() {
  const t = useTranslations("home.hero");
  return (
    <section className="relative overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-site)]">
      <div className="relative mx-auto max-w-[1200px] px-6 pb-20 pt-28 text-center sm:pb-24 sm:pt-36">
        <div className="mx-auto max-w-4xl">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--fg-primary)] sm:text-6xl">
            {t("title")}{" "}
            <span className="text-[var(--accent-text)]">{t("titleAccent")}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--fg-secondary)]">
            {t("description")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href="/playground">
              <Play className="h-4 w-4" /> {t("ctaPrimary")}
            </Button>
            <Button href="#infra" secondary>
              {t("ctaSecondary")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustBar() {
  const t = useTranslations("home.trust");
  const stats = [
    { value: t("uptime"), label: t("uptimeLabel") },
    { value: t("savings"), label: t("savingsLabel") },
    { value: t("autoscale"), label: t("autoscaleLabel") },
  ];
  return (
    <section className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <div className="mx-auto grid max-w-[1200px] grid-cols-3 gap-6 px-6 py-10 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-2xl font-semibold tracking-[-0.02em] text-[var(--fg-primary)] sm:text-3xl">
              {stat.value}
            </p>
            <p className="mt-1.5 text-xs leading-snug text-[var(--fg-muted)] sm:text-sm">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function InfraFeatureSection({
  namespace,
  id,
  className = "",
}: {
  namespace: "infra" | "cost" | "stack";
  id?: string;
  className?: string;
}) {
  const t = useTranslations(`home.${namespace}`);
  const cards = t.raw("cards") as FeatureCard[];
  const icons = SECTION_ICONS[namespace];

  return (
    <Section id={id} className={className}>
      <Reveal>
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <Heading>{t("title")}</Heading>
        <p className={`mt-5 max-w-2xl leading-relaxed text-[var(--fg-secondary)] ${MARKETING_TYPOGRAPHY.lead}`}>
          {t("description")}
        </p>
      </Reveal>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {cards.map((card, index) => {
          const Icon = icons[index];
          return (
            <Reveal key={card.title} delay={index * 70}>
              <article className="h-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
                {Icon ? <Icon className="h-5 w-5 text-[var(--accent)]" strokeWidth={1.7} /> : null}
                <h3 className={`mt-5 font-semibold text-[var(--fg-primary)] ${MARKETING_TYPOGRAPHY.cardTitle}`}>
                  {card.title}
                </h3>
                <p className={`mt-2 leading-relaxed text-[var(--fg-muted)] ${MARKETING_TYPOGRAPHY.body}`}>
                  {card.description}
                </p>
              </article>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}

function Bridge() {
  const t = useTranslations("home.bridge");
  return (
    <Section className="border-y border-[var(--border-subtle)]">
      <Reveal>
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <Heading>{t("title")}</Heading>
        <p className={`mt-5 max-w-2xl leading-relaxed text-[var(--fg-secondary)] ${MARKETING_TYPOGRAPHY.lead}`}>
          {t("description")}
        </p>
        <Link
          href="/html-to-json"
          className="mt-6 inline-flex items-center gap-1.5 font-semibold text-[var(--accent-text)] no-underline hover:underline"
        >
          {t("link")} <ArrowRight className="h-4 w-4" />
        </Link>
      </Reveal>
    </Section>
  );
}

type FaqItem = { question: string; answer: string };

function Faq() {
  const t = useTranslations("home.faq");
  const items = t.raw("items") as FaqItem[];

  return (
    <Section className="border-b border-[var(--border-subtle)]">
      <Reveal>
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <Heading>{t("title")}</Heading>
      </Reveal>
      <div className="mx-auto mt-10 max-w-5xl divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
        {items.map((item, index) => (
          <Reveal key={item.question} delay={Math.min(index * 40, 280)}>
            <details className="group py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-xl font-semibold text-[var(--fg-primary)] marker:content-none">
                {item.question}
                <ChevronDown className="h-5 w-5 shrink-0 text-[var(--fg-muted)] transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="mt-4 space-y-3">
                {item.answer.split("\n\n").map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 40)}
                    className="text-lg leading-relaxed text-[var(--fg-secondary)]"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </details>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function FinalCta() {
  const t = useTranslations("home.finalCta");
  return (
    <section className="bg-[var(--bg-site)]">
      <div className="mx-auto max-w-4xl px-6 py-24 text-center">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-[var(--fg-primary)] sm:text-6xl">
          {t("title")}
        </h2>
        <p className={`mx-auto mt-5 max-w-xl leading-relaxed text-[var(--fg-secondary)] ${MARKETING_TYPOGRAPHY.lead}`}>
          {t("description")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/playground">{t("ctaPrimary")}</Button>
          <Button href="/html-to-json" secondary>
            {t("ctaSecondary")}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <main className="bg-[var(--bg-site)] text-[var(--fg-primary)]">
      <Hero />
      <TrustBar />
      <InfraFeatureSection namespace="infra" id="infra" className="border-b border-[var(--border-subtle)]" />
      <InfraFeatureSection namespace="cost" className="border-b border-[var(--border-subtle)]" />
      <InfraFeatureSection namespace="stack" />
      <Bridge />
      <Faq />
      <FinalCta />
    </main>
  );
}
