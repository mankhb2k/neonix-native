"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  motionBlocks,
  motionLibrary,
} from "@motionvideo/template-library";
import type {
  BlockFamily,
  MotionBlock,
  MotionLibrarySection,
  MotionLibraryShelfId,
} from "@motionvideo/template-library";
import { AppLink } from "@/components/AppLink";
import { BlockPreview } from "@/components/lab/BlockPreview";

type FamilyFilter = "all" | BlockFamily;
type ShelfFilter = "all" | MotionLibraryShelfId;

function matchesQuery(block: MotionBlock, q: string): boolean {
  if (!q) return true;
  const hay = [
    block.id,
    block.name,
    block.nameVi,
    block.description,
    block.preset ?? "",
    block.kind,
    block.family,
    block.intent ?? "",
    block.shelf,
    ...block.tags,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function BlockCard({ block }: { block: MotionBlock }) {
  return (
    <AppLink
      href={`/lab/blocks/${encodeURIComponent(block.id)}`}
      className="mv-block-card"
    >
      <div className="mv-block-card-preview" aria-hidden>
        <BlockPreview
          block={block}
          text={block.sampleText}
          duration={block.duration || 0.6}
          playId={0}
          card
        />
      </div>
      <div className="mv-block-card-body">
        <code className="mv-block-card-id">{block.id}</code>
        <h3>{block.nameVi}</h3>
        <p>{block.description}</p>
        <div className="mv-block-card-tags">
          <span className="mv-pill">{block.family}</span>
          <span className="mv-pill">{block.shelf}</span>
          {block.family === "animation" ? (
            <span className="mv-pill">{block.duration}s</span>
          ) : null}
        </div>
      </div>
    </AppLink>
  );
}

function BlockSection({
  section,
  query,
}: {
  section: MotionLibrarySection;
  query: string;
}) {
  const blocks = section.blocks.filter((b) => matchesQuery(b, query));
  const empty = blocks.length === 0;

  return (
    <section id={`shelf-${section.id}`} className="mv-lab-section">
      <h2 className="mv-hub-section-title">
        {section.title}
        <span className="mv-hub-section-vi"> · {section.titleVi}</span>
        <span className="mv-hub-section-vi">
          {" "}
          · {section.family === "meta" ? "meta" : section.family}
        </span>
      </h2>
      <p className="mv-hub-lead" style={{ marginTop: "0.35rem" }}>
        {section.description}
        {!section.isBlockShelf ? (
          <span> — không phải block.</span>
        ) : empty ? (
          <span>
            {section.blocks.length === 0
              ? " — kệ trống (MVP)."
              : " — không khớp tìm kiếm."}
          </span>
        ) : (
          <span> — {blocks.length} block.</span>
        )}
      </p>

      {!empty ? (
        <div className="mv-block-card-grid">
          {blocks.map((block) => (
            <BlockCard key={`${section.id}-${block.id}`} block={block} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  muted,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      className={`mv-filter-chip${active ? " is-active" : ""}${muted ? " is-muted" : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function BlockLabCatalog() {
  const [family, setFamily] = useState<FamilyFilter>("all");
  const [shelf, setShelf] = useState<ShelfFilter>("all");
  const [showEmpty, setShowEmpty] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const sectionById = useMemo(() => {
    const map = new Map<MotionLibraryShelfId, MotionLibrarySection>();
    for (const s of motionLibrary) map.set(s.id, s);
    return map;
  }, []);

  const contentShelves = useMemo(
    () => motionLibrary.filter((s) => s.family === "content"),
    [],
  );
  const animationShelves = useMemo(
    () => motionLibrary.filter((s) => s.family === "animation"),
    [],
  );

  const visibleSections = useMemo(() => {
    let sections = motionLibrary;

    if (family !== "all") {
      sections = sections.filter((s) => s.family === family);
    }
    if (shelf !== "all") {
      sections = sections.filter((s) => s.id === shelf);
    } else if (!showEmpty) {
      sections = sections.filter(
        (s) => s.blocks.length > 0 || s.id === "timing",
      );
    }

    if (q) {
      sections = sections.filter((s) => {
        if (!s.isBlockShelf) return s.id === "timing" && "timing".includes(q);
        return s.blocks.some((b) => matchesQuery(b, q));
      });
    }

    return sections;
  }, [family, shelf, showEmpty, q]);

  const uniqueVisible = useMemo(() => {
    const ids = new Set<string>();
    for (const s of visibleSections) {
      for (const b of s.blocks) {
        if (matchesQuery(b, q)) ids.add(b.id);
      }
    }
    return ids.size;
  }, [visibleSections, q]);

  const contentCount = motionBlocks.filter((b) => b.family === "content").length;
  const animationCount = motionBlocks.filter(
    (b) => b.family === "animation",
  ).length;

  function selectFamily(next: FamilyFilter) {
    setFamily(next);
    setShelf("all");
  }

  function chipCount(id: MotionLibraryShelfId): number {
    return sectionById.get(id)?.blocks.length ?? 0;
  }

  return (
    <div className="mv-hub">
      <header className="mv-hub-header">
        <AppLink href="/" className="mv-hub-brand">
          MotionVideo
        </AppLink>
        <nav className="mv-hub-nav">
          <AppLink href="/">Workspace</AppLink>
        </nav>
      </header>

      <main className="mv-hub-main" style={{ maxWidth: 960 }}>
        <p className="mv-hub-kicker">Motion Library</p>
        <h1 className="mv-hub-title">Thư viện block</h1>
        <p className="mv-hub-lead">
          Content {contentCount} · Animation {animationCount} · đang xem{" "}
          {uniqueVisible} id · {visibleSections.length} nhóm.
        </p>

        <div className="mv-lab-filters">
          <div className="mv-lab-filter-row">
            <span className="mv-lab-filter-label">Tìm</span>
            <input
              className="mv-lab-filter-search"
              type="search"
              placeholder="id, tên, preset, tag…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Tìm block"
            />
          </div>

          <div className="mv-lab-filter-row">
            <span className="mv-lab-filter-label">Loại</span>
            <div className="mv-lab-filter-chips" role="group" aria-label="Family">
              <FilterChip
                active={family === "all"}
                onClick={() => selectFamily("all")}
              >
                Tất cả
              </FilterChip>
              <FilterChip
                active={family === "content"}
                onClick={() => selectFamily("content")}
              >
                Content · {contentCount}
              </FilterChip>
              <FilterChip
                active={family === "animation"}
                onClick={() => selectFamily("animation")}
              >
                Animation · {animationCount}
              </FilterChip>
              <FilterChip
                active={showEmpty}
                onClick={() => setShowEmpty((v) => !v)}
              >
                {showEmpty ? "Ẩn kệ trống" : "Hiện kệ trống"}
              </FilterChip>
            </div>
          </div>

          {(family === "all" || family === "content") && (
            <div className="mv-lab-filter-row">
              <span className="mv-lab-filter-label">Content</span>
              <div className="mv-lab-filter-chips" role="group" aria-label="Content">
                <FilterChip
                  active={shelf === "all" && family === "content"}
                  onClick={() => {
                    setFamily("content");
                    setShelf("all");
                  }}
                >
                  Tất cả content
                </FilterChip>
                {contentShelves.map((s) => {
                  const n = chipCount(s.id);
                  return (
                    <FilterChip
                      key={s.id}
                      active={shelf === s.id}
                      muted={n === 0}
                      onClick={() => {
                        setFamily("content");
                        setShelf(s.id);
                      }}
                    >
                      {s.title}
                      {n > 0 ? ` · ${n}` : ""}
                    </FilterChip>
                  );
                })}
              </div>
            </div>
          )}

          {(family === "all" || family === "animation") && (
            <div className="mv-lab-filter-row">
              <span className="mv-lab-filter-label">Motion</span>
              <div
                className="mv-lab-filter-chips"
                role="group"
                aria-label="Animation"
              >
                <FilterChip
                  active={shelf === "all" && family === "animation"}
                  onClick={() => {
                    setFamily("animation");
                    setShelf("all");
                  }}
                >
                  Tất cả motion
                </FilterChip>
                {animationShelves.map((s) => {
                  const n = chipCount(s.id);
                  return (
                    <FilterChip
                      key={s.id}
                      active={shelf === s.id}
                      muted={n === 0}
                      onClick={() => {
                        setFamily("animation");
                        setShelf(s.id);
                      }}
                    >
                      {s.title}
                      {n > 0 ? ` · ${n}` : ""}
                    </FilterChip>
                  );
                })}
                <FilterChip
                  active={shelf === "timing"}
                  onClick={() => {
                    setFamily("all");
                    setShelf("timing");
                  }}
                >
                  Timing
                </FilterChip>
              </div>
            </div>
          )}
        </div>

        {visibleSections.length === 0 ? (
          <p className="mv-hub-lead" style={{ marginTop: "1.5rem" }}>
            Không có kết quả. Xóa tìm kiếm hoặc chọn kệ khác.
          </p>
        ) : (
          visibleSections.map((section) => (
            <BlockSection key={section.id} section={section} query={q} />
          ))
        )}
      </main>
    </div>
  );
}
