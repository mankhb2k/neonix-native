"use client";

import { motionLibrary } from "@motionvideo/template-library";
import type { MotionBlock, MotionLibrarySection } from "@motionvideo/template-library";
import { AppLink } from "@/components/AppLink";
import { BlockPreview } from "@/components/lab/BlockPreview";

function BlockSection({ section }: { section: MotionLibrarySection }) {
  const empty = section.blocks.length === 0;

  return (
    <section id={`shelf-${section.id}`} style={{ marginTop: "2rem" }}>
      <h2 className="mv-hub-section-title">
        {section.title}
        <span className="mv-hub-section-vi"> · {section.titleVi}</span>
      </h2>
      <p className="mv-hub-lead" style={{ marginTop: "0.35rem" }}>
        {section.description}
        {!section.isBlockShelf ? (
          <span> — không phải MotionBlock.</span>
        ) : empty ? (
          <span> — kệ trống (MVP).</span>
        ) : (
          <span> — {section.blocks.length} block.</span>
        )}
      </p>

      {!empty ? (
        <div className="mv-block-card-grid">
          {section.blocks.map((block: MotionBlock) => (
            <AppLink
              key={`${section.id}-${block.id}`}
              href={`/lab/blocks/${encodeURIComponent(block.id)}`}
              className="mv-block-card"
            >
              <div className="mv-block-card-preview" aria-hidden>
                <BlockPreview
                  block={block}
                  text={block.sampleText}
                  duration={block.duration}
                  playId={0}
                  card
                />
              </div>
              <div className="mv-block-card-body">
                <code className="mv-block-card-id">{block.id}</code>
                <h3>{block.nameVi}</h3>
                <p>{block.description}</p>
                <div className="mv-block-card-tags">
                  <span className="mv-pill">{block.shelf}</span>
                  <span className="mv-pill">{block.duration}s</span>
                </div>
              </div>
            </AppLink>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function BlockLabCatalog() {
  const filled = motionLibrary.filter((s) => s.blocks.length > 0);
  const totalUnique = new Set(
    motionLibrary.flatMap((s) => s.blocks.map((b) => b.id)),
  ).size;

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
        <h1 className="mv-hub-title">Thư viện motion</h1>
        <p className="mv-hub-lead">
          {motionLibrary.length} kệ · {filled.length} đang có block ·{" "}
          {totalUnique} id duy nhất. Target (Text/Shape…) tách khỏi intent
          (Entrance/Exit…); Timing = schema chung.
        </p>

        <nav className="mv-library-toc" aria-label="Shelves">
          {motionLibrary.map((s) => (
            <a key={s.id} href={`#shelf-${s.id}`} className="mv-pill">
              {s.title}
              {s.blocks.length > 0 ? ` ${s.blocks.length}` : ""}
            </a>
          ))}
        </nav>

        {motionLibrary.map((section) => (
          <BlockSection key={section.id} section={section} />
        ))}
      </main>
    </div>
  );
}
