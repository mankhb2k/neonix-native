"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { MotionBlock } from "@motionvideo/template-library";

type Props = {
  block: MotionBlock;
  text: string;
  duration: number;
  playId: number;
  /** Smaller looping preview on catalog cards */
  card?: boolean;
};

function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter("vi", { granularity: "grapheme" });
    return [...seg.segment(text)].map((s) => s.segment);
  }
  return Array.from(text);
}

export function BlockPreview({
  block,
  text,
  duration,
  playId,
  card = false,
}: Props) {
  const className = `${block.previewClass}${card ? " is-card" : ""}`;

  if (block.family === "content") {
    if (
      block.kind === "shape" ||
      block.kind === "media" ||
      block.kind === "character" ||
      block.kind === "container" ||
      block.kind === "data"
    ) {
      return (
        <div
          className={className}
          key={playId}
          role="img"
          aria-label={block.name}
        >
          {block.kind !== "shape" ? (
            <span className="mv-block-content-media-label">
              {block.sampleText || block.name}
            </span>
          ) : null}
        </div>
      );
    }

    if (block.id === "text.bullet-list" || block.id === "text.checklist") {
      const items = (text || "…")
        .split(/\n|·|•/)
        .map((s) => s.trim())
        .filter(Boolean);
      const bullet = block.id === "text.checklist" ? "✓" : "•";
      return (
        <ul className={className} key={playId}>
          {items.map((item, i) => (
            <li key={`${playId}-${i}`}>
              <span aria-hidden>{bullet}</span> {item}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p className={className} key={playId}>
        {text || "…"}
      </p>
    );
  }

  if (block.shelf === "camera-presets" || block.kind === "camera") {
    return (
      <div className={`mv-block-cam-stage${card ? " is-card" : ""}`} key={playId}>
        <div
          className={className}
          style={{ animationDuration: `${duration}s` }}
        />
      </div>
    );
  }

  if (block.shelf === "shape-animation") {
    return (
      <div
        className={`mv-block-shape-anim-stage${card ? " is-card" : ""}`}
        key={playId}
        role="img"
        aria-label={block.name}
      >
        <div
          className={className}
          style={
            {
              animationDuration: `${duration}s`,
              ["--mv-dur"]: `${duration}s`,
            } as CSSProperties
          }
        />
      </div>
    );
  }

  if (block.shelf === "transition") {
    return (
      <div
        className={`mv-block-trans-stage${card ? " is-card" : ""}`}
        key={playId}
        role="img"
        aria-label={block.name}
      >
        <div
          className={className}
          style={{ animationDuration: `${duration}s` }}
        >
          <span className="mv-block-trans-panel is-a" />
          <span className="mv-block-trans-panel is-b" />
        </div>
      </div>
    );
  }

  if (block.id === "text.stagger-words") {
    const words = splitWords(text || "…");
    const step = duration / Math.max(words.length, 1);
    return (
      <p className={className} key={playId}>
        {words.map((word, i) => (
          <span
            key={`${playId}-${i}-${word}`}
            className="mv-block-stagger-word"
            style={{
              animationDelay: `${i * step * 0.55}s`,
              animationDuration: `${Math.max(step * 1.2, 0.25)}s`,
            }}
          >
            {word}
            {i < words.length - 1 ? "\u00A0" : ""}
          </span>
        ))}
      </p>
    );
  }

  if (block.id === "text.typewriter" || block.id === "text.typing") {
    return (
      <TypingPreview
        key={playId}
        text={text}
        duration={duration}
        className={className}
        card={card}
      />
    );
  }

  if (block.id === "text.counter") {
    return (
      <CounterPreview
        key={playId}
        text={text}
        duration={duration}
        className={className}
        card={card}
      />
    );
  }

  return (
    <p
      className={className}
      key={playId}
      style={{ animationDuration: `${duration}s` }}
    >
      {text || "…"}
    </p>
  );
}

function TypingPreview({
  text,
  duration,
  className,
  card,
}: {
  text: string;
  duration: number;
  className: string;
  card: boolean;
}) {
  const source = text || "…";
  const chars = graphemes(source);
  const [count, setCount] = useState(card ? chars.length : 0);

  useEffect(() => {
    const units = graphemes(source);
    if (card) {
      setCount(units.length);
      return;
    }
    setCount(0);
    if (units.length === 0) return undefined;
    const tick = (duration * 1000) / units.length;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= units.length) window.clearInterval(id);
    }, Math.max(tick, 16));
    return () => window.clearInterval(id);
  }, [source, duration, card]);

  return (
    <p className={className}>
      {chars.slice(0, count).join("")}
      <span className="mv-block-caret" aria-hidden>
        |
      </span>
    </p>
  );
}

function CounterPreview({
  text,
  duration,
  className,
  card,
}: {
  text: string;
  duration: number;
  className: string;
  card: boolean;
}) {
  const target = Number.parseInt(text.replace(/[^\d-]/g, ""), 10) || 0;
  const [value, setValue] = useState(card ? target : 0);

  useEffect(() => {
    if (card) {
      setValue(target);
      return;
    }
    setValue(0);
    const start = performance.now();
    const ms = duration * 1000;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, card]);

  return <p className={className}>{value}</p>;
}
