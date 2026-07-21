"use client";

import { useState } from "react";
import type { MotionBlock } from "@motionvideo/template-library";
import { AppLink } from "@/components/AppLink";
import { BlockPreview } from "@/components/lab/BlockPreview";

type Props = {
  block: MotionBlock;
};

export function BlockLabDetail({ block }: Props) {
  const isContent = block.family === "content";
  const [text, setText] = useState(block.sampleText);
  const [duration, setDuration] = useState(
    block.duration > 0 ? block.duration : 0.6,
  );
  const [playId, setPlayId] = useState(0);

  function replay() {
    setPlayId((n) => n + 1);
  }

  return (
    <div className="mv-hub">
      <header className="mv-hub-header">
        <AppLink href="/" className="mv-hub-brand">
          MotionVideo
        </AppLink>
        <nav className="mv-hub-nav">
          <AppLink href="/lab/blocks">Tất cả block</AppLink>
          <AppLink href="/">Workspace</AppLink>
        </nav>
      </header>

      <main className="mv-hub-main" style={{ maxWidth: 880 }}>
        <p className="mv-hub-kicker">
          {isContent ? "Content" : "Animation"} · {block.shelf}
        </p>
        <h1 className="mv-hub-title">{block.id}</h1>
        <p className="mv-hub-lead">
          {block.nameVi} — {block.description}
        </p>

        <div className="mv-block-lab">
          <div className="mv-block-lab-stage">
            <p className="mv-block-lab-label">Preview</p>
            <div className="mv-block-lab-frame">
              <BlockPreview
                block={block}
                text={text}
                duration={duration}
                playId={playId}
              />
            </div>
            {!isContent ? (
              <button
                type="button"
                className="mv-btn mv-btn-primary"
                onClick={replay}
                style={{ marginTop: "1rem" }}
              >
                Phát lại
              </button>
            ) : null}
          </div>

          <aside className="mv-block-lab-meta">
            <h2>Metadata</h2>
            <dl className="mv-block-lab-dl">
              <div>
                <dt>ID</dt>
                <dd>
                  <code>{block.id}</code>
                </dd>
              </div>
              <div>
                <dt>Family</dt>
                <dd>{block.family}</dd>
              </div>
              <div>
                <dt>Kind</dt>
                <dd>{block.kind}</dd>
              </div>
              <div>
                <dt>Shelf</dt>
                <dd>{block.shelf}</dd>
              </div>
              <div>
                <dt>Intent</dt>
                <dd>{block.intent ?? "—"}</dd>
              </div>
              <div>
                <dt>Preset</dt>
                <dd>
                  <code>{block.preset ?? "—"}</code>
                </dd>
              </div>
              {!isContent ? (
                <div>
                  <dt>Duration mặc định</dt>
                  <dd>{block.duration}s</dd>
                </div>
              ) : null}
              <div>
                <dt>Tags</dt>
                <dd>{block.tags.join(", ")}</dd>
              </div>
            </dl>

            <div className="mv-field" style={{ marginTop: "1.25rem" }}>
              <label htmlFor="sample">
                {block.id === "text.counter"
                  ? "Số đích"
                  : isContent
                    ? "Nội dung mẫu"
                    : "Chữ thử (tiếng Việt)"}
              </label>
              <input
                id="sample"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={replay}
              />
            </div>
            {!isContent ? (
              <div className="mv-field">
                <label htmlFor="dur">Duration: {duration.toFixed(2)}s</label>
                <input
                  id="dur"
                  type="range"
                  min={block.durationMin}
                  max={block.durationMax}
                  step={0.05}
                  value={duration}
                  onChange={(e) => {
                    setDuration(Number(e.target.value));
                    replay();
                  }}
                />
              </div>
            ) : null}

            <pre className="mv-block-lab-json">
              {JSON.stringify(
                isContent
                  ? {
                      id: block.id,
                      family: block.family,
                      kind: block.kind,
                      sampleText: text,
                    }
                  : {
                      id: block.id,
                      family: block.family,
                      kind: block.kind,
                      duration,
                      preset: block.preset,
                      sampleText: text,
                    },
                null,
                2,
              )}
            </pre>
          </aside>
        </div>
      </main>
    </div>
  );
}
