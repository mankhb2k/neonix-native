"use client";

import { attemptParse } from "@/lib/docs/parse-result";
import { useEditorStore } from "@/lib/editor/editor-store";
import {
  envelopeToAuthoringSugar,
  expandAuthoringToCore,
  mergeAuthoringSugar,
} from "@motionvideo/editor-core";
import { serializeMotionProjectV1Authoring } from "@motionvideo/patterns";
import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";

/**
 * Read-only expanded core JSON — what would be saved to disk after expand.
 */
export function ProtocolJsonPanel() {
  const project = useEditorStore((s) => s.project);
  const envelope = useEditorStore((s) => s.envelope);
  const [copied, setCopied] = useState(false);

  const json = useMemo(() => {
    if (!project) return "";
    const sugar = envelope ? envelopeToAuthoringSugar(envelope) : {};
    const core = expandAuthoringToCore(
      mergeAuthoringSugar(project, sugar),
      sugar,
    );
    return serializeMotionProjectV1Authoring(core);
  }, [project, envelope]);
  const parse = useMemo(() => {
    if (!project) return { ok: false, message: "No project loaded." };
    return attemptParse(JSON.parse(json));
  }, [json, project]);

  const onCopy = async () => {
    if (!json) return;
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  if (!project) {
    return (
      <div
        className="px-3 py-6 text-[12px] text-[var(--fg-muted)]"
        data-testid="protocol-json-panel"
      >
        No project loaded.
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="protocol-json-panel"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          data-testid="protocol-json-parse-badge"
          data-parse-ok={parse.ok ? "true" : "false"}
          title={parse.message}
        >
          {parse.ok ? "core OK" : "parse error"}
        </span>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-2 py-1 text-[11px] font-medium text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
          data-testid="protocol-json-copy"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed"
        style={{
          background: "var(--code-block-bg)",
          color: "var(--code-block-fg)",
          fontFamily: "var(--font-mono)",
        }}
        data-testid="protocol-json-pre"
      >
        {json}
      </pre>
    </div>
  );
}
