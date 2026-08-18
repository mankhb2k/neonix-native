"use client";

import { Button } from "@/components/ui";
import {
  useAiJobsStore,
  type RegenerationScope,
} from "@/lib/editor/ai/ai-jobs-store";
import { useEditorStore } from "@/lib/editor/editor-store";
import { rootLayerIdOf } from "@motionvideo/editor-core";
import { SendHorizontal, Square } from "lucide-react";

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
      ? `${rootLayerIdOf(project, selection.layerId) ?? selection.layerId}/${selection.layerId}`
      : undefined;

  const protectedHint =
    selection.kind === "node" && envelope
      ? Object.entries(envelope.authoring.elementMeta).find(([key]) =>
          key.endsWith(`:${selection.layerId}`),
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
    <div className="flex h-full min-h-0 flex-col" data-testid="editor-ask-ai">
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
          <p
            className="text-[11px] text-[var(--danger)]"
            data-testid="ai-job-error"
          >
            {error}
          </p>
        ) : null}

        {(busy || phase === "ready") && (
          <div className="space-y-1.5 text-[11px] text-[var(--fg-muted)]">
            <div className="flex items-center justify-between gap-2">
              <span className="uppercase tracking-[0.08em]">{phase}</span>
              {protectedHint?.lockedProperties?.length ? (
                <span>
                  Protected:{" "}
                  {protectedHint.lockedProperties.slice(0, 3).join(", ")}
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
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 shadow-sm"
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissProposal()}
              >
                Discard
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 bg-[var(--bg-editor)] p-3">
        <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] focus-within:border-[var(--border-focus)]">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={
              selectionLabel
                ? `Refine ${selectionLabel}…`
                : "Mô tả brief hoặc chỉnh sửa scoped…"
            }
            rows={3}
            className="w-full resize-none border-0 bg-transparent px-3 pt-2.5 pb-1 text-[13px] text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-disabled)]"
            disabled={busy}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                prompt.trim() &&
                !busy
              ) {
                event.preventDefault();
                runGenerate();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              {/* Slot for future model / mode controls */}
            </div>
            <button
              type="button"
              aria-label={busy ? "Cancel" : "Send"}
              disabled={!busy && !prompt.trim()}
              onClick={() => {
                if (busy) {
                  cancel();
                  return;
                }
                runGenerate();
              }}
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--accent)] text-[var(--accent-on)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[var(--accent-hover)]"
            >
              {busy ? (
                <Square size={12} fill="currentColor" />
              ) : (
                <SendHorizontal size={14} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
