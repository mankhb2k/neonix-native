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

/** AI chat panel — lives in Inspector AI tab. */
export function AskAIBar() {
  const selection = useEditorStore((s) => s.selection);
  const envelope = useEditorStore((s) => s.envelope);
  const project = useEditorStore((s) => s.project);
  const applyAiProject = useEditorStore((s) => s.applyAiProject);
  const scope = useAiJobsStore((s) => s.scope);
  const prompt = useAiJobsStore((s) => s.prompt);
  const phase = useAiJobsStore((s) => s.phase);
  const progress = useAiJobsStore((s) => s.progress);
  const proposal = useAiJobsStore((s) => s.proposal);
  const error = useAiJobsStore((s) => s.error);
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

  const runGenerate = () => {
    void startGeneration({
      prompt: prompt.trim(),
      scope,
      baseRevision: envelope?.revision ?? 1,
      selectionLabel,
      project,
    });
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="editor-ask-ai"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2.5">
        <Sparkles size={15} className="text-[var(--accent-text)]" />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[var(--fg-primary)]">
            Ask AI
          </p>
          <p className="truncate text-[10px] text-[var(--fg-muted)]">
            {selectionLabel
              ? `Scoped: ${selectionLabel}`
              : "Brief toàn video hoặc refine theo selection"}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {SCOPES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                scope === item.id
                  ? "h-7 cursor-pointer rounded-full border-0 bg-[var(--accent-soft)] px-2.5 text-[11px] font-semibold text-[var(--accent-text)]"
                  : "h-7 cursor-pointer rounded-full border-0 bg-[var(--bg-surface)] px-2.5 text-[11px] font-medium text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-secondary)]"
              }
              onClick={() => setScope(item.id)}
              disabled={busy}
            >
              {item.label}
            </button>
          ))}
        </div>

        {phase === "failed" && error ? (
          <p className="text-[11px] text-[var(--danger)]" data-testid="ai-job-error">
            {error}
          </p>
        ) : null}

        {(busy || phase === "ready") && (
          <div className="space-y-1.5 text-[11px] text-[var(--fg-muted)]">
            <div className="flex items-center justify-between gap-2">
              <span className="uppercase tracking-[0.08em]">{phase}</span>
              {protectedHint?.lockedProperties?.length ? (
                <span>
                  Protected: {protectedHint.lockedProperties.slice(0, 3).join(", ")}
                </span>
              ) : null}
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[var(--bg-hover)]">
              <div
                className="h-full bg-[var(--accent)] transition-[width] duration-300"
                style={{ width: `${progress}%` }}
                data-testid="ai-job-progress"
              />
            </div>
          </div>
        )}

        {proposal ? (
          <div
            className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-sm)]"
            data-testid="ai-proposal-diff"
          >
            <p className="text-[12px] font-medium text-[var(--fg-primary)]">
              {proposal.summary}
            </p>
            <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
              baseRevision {proposal.baseRevision} ·{" "}
              {proposal.commandLabels.join(" → ")}
              {proposal.generation?.criticScore != null
                ? ` · critic ${proposal.generation.criticScore}`
                : ""}
            </p>
            {proposal.warnings.length > 0 ? (
              <ul className="mt-1.5 list-inside list-disc text-[10px] text-[var(--fg-muted)]">
                {proposal.warnings.slice(0, 3).map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-2.5 flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const applied = applyProposal();
                  if (!applied?.project) return;
                  if (
                    applied.scope !== "video" &&
                    envelope &&
                    applied.baseRevision !== envelope.revision
                  ) {
                    return;
                  }
                  applyAiProject(applied.project, {
                    generation: applied.generation,
                    revision: applied.revision,
                    affectedElementKeys: applied.affectedElementKeys,
                    label: `ai.${applied.scope}`,
                  });
                }}
              >
                Apply
              </Button>
              <Button variant="ghost" size="sm" onClick={() => dismissProposal()}>
                Discard
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--border-subtle)] px-3 py-4 text-[12px] leading-relaxed text-[var(--fg-muted)]">
            Mô tả brief hoặc chỉnh sửa scoped. AI chỉ emit typed commands — không
            sinh CSS/TSX.
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-[var(--border-subtle)] bg-[var(--bg-panel)] p-3">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={
            selectionLabel
              ? `Refine ${selectionLabel}…`
              : "Mô tả brief hoặc chỉnh sửa scoped…"
          }
          rows={3}
          className="w-full resize-none rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-disabled)] focus:border-[var(--border-focus)] focus:bg-[var(--bg-panel)]"
          disabled={busy}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && prompt.trim() && !busy) {
              event.preventDefault();
              runGenerate();
            }
          }}
        />
        <div className="flex justify-end gap-2">
          {busy ? (
            <Button variant="secondary" size="md" onClick={() => cancel()}>
              Cancel
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              disabled={!prompt.trim()}
              onClick={() => runGenerate()}
            >
              Generate
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
