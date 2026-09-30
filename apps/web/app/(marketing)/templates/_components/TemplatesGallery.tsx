"use client";

import { ChevronDown, Play, Search } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Dropdown } from "@/components/ui/Dropdown/Dropdown";

export type TemplateItem = {
  id: string;
  title: string;
  category: string;
  description: string;
  accent: string;
  ratio: string;
};

const MAX_VISIBLE_BADGES = 8;

export function TemplatesGallery({ items }: { items: readonly TemplateItem[] }) {
  const t = useTranslations("TemplatesGallery");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const runSearch = () => setQuery(searchInput);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.category)));
    return ["All", ...unique];
  }, [items]);

  const { visibleCategories, overflowCategories } = useMemo(() => {
    const visible = categories.slice(0, MAX_VISIBLE_BADGES);
    const overflow = categories.slice(MAX_VISIBLE_BADGES);

    // Keep the active category visible even if it would otherwise overflow
    // into the "More" dropdown — swap it in for the last visible badge.
    if (!visible.includes(activeCategory)) {
      const overflowIndex = overflow.indexOf(activeCategory);
      if (overflowIndex !== -1) {
        const [swappedIn] = overflow.splice(overflowIndex, 1);
        const bumped = visible.pop();
        if (bumped) overflow.unshift(bumped);
        if (swappedIn) visible.push(swappedIn);
      }
    }

    return { visibleCategories: visible, overflowCategories: overflow };
  }, [categories, activeCategory]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = activeCategory === "All" || item.category === activeCategory;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.category.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [items, query, activeCategory]);

  return (
    <section className="px-6 pt-[54px] pb-16 sm:pb-20">
      <div className="mx-auto max-w-[1600px]">
        <div className="mx-auto mb-[34px] max-w-2xl text-center">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{t("title")}</h1>
          <p className="mt-3 text-base leading-relaxed text-[var(--fg-secondary)] sm:text-lg">
            {t("description")}
          </p>
        </div>

        {/* Toolbar — category badges on the left, search + filter on the right */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {visibleCategories.map((category) => {
              const isActive = category === activeCategory;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`inline-flex h-9 items-center justify-center rounded-full px-3.5 text-sm font-semibold transition ${
                    isActive
                      ? "bg-[var(--accent)] text-[var(--accent-on)]"
                      : "border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--fg-secondary)] hover:border-[var(--accent)] hover:text-[var(--fg-primary)]"
                  }`}
                >
                  {category}
                </button>
              );
            })}
            {overflowCategories.length > 0 ? (
              <Dropdown
                align="start"
                label="More categories"
                trigger={
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3.5 text-sm font-semibold text-[var(--fg-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--fg-primary)]"
                  >
                    More
                    <ChevronDown className="size-3.5" />
                  </button>
                }
                items={overflowCategories.map((category) => ({
                  label: category,
                  onSelect: () => setActiveCategory(category),
                }))}
              />
            ) : null}
          </div>

          <form
            className="flex flex-shrink-0 gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              runSearch();
            }}
          >
            <label className="relative flex-1 sm:w-96">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search templates"
                className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] pr-3 pl-9 text-sm text-[var(--fg-primary)] outline-none transition placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)]"
              />
            </label>
            <button
              type="submit"
              aria-label="Search"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] transition hover:border-[var(--accent)] hover:text-[var(--fg-primary)]"
            >
              <Search className="size-4" />
            </button>
          </form>
        </div>

        {/* Gallery — a Pinterest-style masonry; the title/description/CTA
            only reveal on hover so the grid stays a clean wall of previews,
            matching how the real MP4 thumbnails will be browsed. CSS columns
            (not grid) so cards of different aspect ratios pack tightly with
            no leftover whitespace. */}
        <div className="mt-8 columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5">
          {filteredItems.map((item) => (
            <Link
              key={item.id}
              href="/playground"
              className={`group relative mb-4 block break-inside-avoid overflow-hidden rounded-xl bg-gradient-to-br no-underline ${item.accent}`}
              style={{ aspectRatio: item.ratio }}
            >
              <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(135deg,transparent_35%,rgba(255,255,255,0.08)_36%,transparent_37%),linear-gradient(45deg,transparent_48%,rgba(34,211,238,0.12)_49%,transparent_50%)] [background-size:32px_32px,48px_48px]" />

              <div className="absolute inset-0 flex items-center justify-center transition-opacity group-hover:opacity-0">
                <span className="flex size-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm">
                  <Play className="ml-0.5 size-4 fill-current" />
                </span>
              </div>
              <span className="absolute top-3 left-3 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs font-medium text-slate-200 backdrop-blur-sm transition-opacity group-hover:opacity-0">
                {item.category}
              </span>

              {/* Hover-only description overlay */}
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/55 to-transparent p-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <h2 className="text-sm font-semibold text-white">{item.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-white/80">{item.description}</p>
                <span className="mt-3 inline-flex h-8 w-fit items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-slate-900">
                  Open in playground
                </span>
              </div>
            </Link>
          ))}
        </div>

        {filteredItems.length === 0 ? (
          <p className="mt-16 text-center text-sm text-[var(--fg-muted)]">
            No templates match your search.
          </p>
        ) : null}
      </div>
    </section>
  );
}
