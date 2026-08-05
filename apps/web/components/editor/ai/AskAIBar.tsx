"use client";

import { Button } from "@/components/ui";
import { useAiJobsStore, type RegenerationScope } from "@/lib/editor/ai/ai-jobs-store";
import { useEditorStore } from "@/lib/editor/editor-store";
import { Sparkles } from "lucide-react";

const SCOPES: Array<{ id: RegenerationScope; label: string }> = [
  { id: "video", label: "Video" },
  { id: "scene", label: "Scene" },
  { id: "element", label: "Element" },
  { id: "motion", label: "Motion" },
  { id: "style", label: "Style" },
];

export function AskAIBar() {
  const selection = useEditorStore((s) => s.selection);
  const envelope = useEditorStore((s) => s.envelope);
  const scope = useAiJobsStore((s) => s.scope);
  const prompt = useAiJobsStore((s) => s.prompt);
  const phase = useAiJobsStore((s) => s.phase);
  const progress = useAiJobsStore((s) => s.progress);
  const proposal = useAiJobsStore((s) => s.proposal);
  const setScope = useAiJobsStore((s) => s.setScope);
  const setPrompt = useAiJobsStore((s) => s.setPrompt);
  const startGeneration = useAiJobsStore((s) => s.startGeneration);
  const cancel = useAiJobsStore((s) => s.cancel);
  const applyProposal = useAiJobsStore((s) => s.applyProposal);
  const dismissProposal = useAiJobsStore((s) => s.dismissProposal);

  const selectionLabel =
    selection.kind === "node"
      ? `${selection.sceneId}/${selection.nodeId}`
      : undefined;

  const protectedHint =
    selection.kind === "node" && envelope
      ? Object.entries(envelope.authoring.elementMeta).find(([key]) =>
          key.endsWith(`:${selection.nodeId}`),
        )?.[1]
      : undefined;

  const busy = phase !== "idle" && phase !== "ready" && phase !== "failed";

  return (
    <footer
      className="editor-area-ask flex flex-col gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2"
      data-testid="editor-ask-ai"
    >
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center gap-1.5 text-[var(--accent-text)]">
          <Sparkles size={16} />
          <span className="text-[12px] font-semibold tracking-tight">Ask AI</span>
        </div>

        <div className="flex shrink-0 gap-1">
          {SCOPES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                scope === item.id
                  ? "h-7 cursor-pointer rounded-[var(--radius-sm)] border-0 bg-[var(--accent-soft)] px-2 text-[11px] font-medium text-[var(--accent-text)]"
                  : "h-7 cursor-pointer rounded-[var(--radius-sm)] border-0 bg-transparent px-2 text-[11px] font-medium text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]"
              }
              onClick={() => setScope(item.id)}
              disabled={busy}
            >
              {item.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={
            selectionLabel
              ? `Refine ${selectionLabel}…`
              : "Mô tả brief hoặc chỉnh sửa scoped…"
          }
          className="h-9 min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg-app)] px-3 text-[13px] text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-disabled)] focus:border-[var(--border-focus)]"
          disabled={busy}
          onKeyDown={(event) => {
            if (event.key === "Enter" && prompt.trim() && !busy) {
              void startGeneration({
                prompt: prompt.trim(),
                scope,
                baseRevision: envelope?.revision ?? 1,
                selectionLabel,
              });
            }
          }}
        />

        {busy ? (
          <Button variant="secondary" size="md" onClick={() => cancel()}>
            Cancel
          </Button>
        ) : (
          <Button
            variant="primary"
            size="md"
            disabled={!prompt.trim()}
            onClick={() =>
              void startGeneration({
                prompt: prompt.trim(),
                scope,
                baseRevision: envelope?.revision ?? 1,
                selectionLabel,
              })
            }
          >
            Generate
          </Button>
        )}
      </div>

      {(busy || phase === "ready") && (
        <div className="flex items-center gap-3 text-[11px] text-[var(--fg-muted)]">
          <span className="uppercase tracking-[0.08em]">{phase}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--bg-hover)]">
            <div
              className="h-full bg-[var(--accent)] transition-[width] duration-300"
              style={{ width: `${progress}%` }}
              data-testid="ai-job-progress"
            />
          </div>
          {protectedHint?.lockedProperties?.length ? (
            <span>
              Protected: {protectedHint.lockedProperties.slice(0, 3).join(", ")}
            </span>
          ) : null}
        </div>
      )}

      {proposal ? (
        <div
          className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg-panel)] p-3"
          data-testid="ai-proposal-diff"
        >
          <p className="text-[12px] font-medium text-[var(--fg-primary)]">
            {proposal.summary}
          </p>
          <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
            baseRevision {proposal.baseRevision} ·{" "}
            {proposal.commandLabels.join(" → ")}
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                applyProposal();
                // Real apply wires ValidatedCommandBatch in later AI planner PR.
              }}
            >
              Apply
            </Button>
            <Button variant="ghost" size="sm" onClick={() => dismissProposal()}>
              Discard
            </Button>
          </div>
        </div>
      ) : null}
    </footer>
  );
}
