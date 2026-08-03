/**
 * Timeline mode toggles — auto snap (N).
 * Active = teal; off = muted.
 */

import type { ReactNode } from "react";
import { useTimelineInteractionPrefs } from "../timeline-interaction-prefs";
import { cn } from "../../../ui";

const ACTIVE = "text-[#14B8A6]";
const IDLE = "text-[var(--fg-secondary)]";

function ToggleButton({
  pressed,
  disabled,
  label,
  title,
  onClick,
  children,
  testId,
}: {
  pressed: boolean;
  disabled?: boolean;
  label: string;
  title: string;
  onClick: () => void;
  children: ReactNode;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      aria-pressed={pressed}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
        "hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-40",
        pressed ? ACTIVE : IDLE,
      )}
    >
      {children}
    </button>
  );
}

/** CapCut: vertical snap line with side blocks + sparkles. */
function SnapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="6.25" width="4.2" height="3.5" rx="0.7" fill="currentColor" />
      <rect x="9.8" y="6.25" width="4.2" height="3.5" rx="0.7" fill="currentColor" />
      <path
        d="M8 3.2v9.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M6.6 3.6h2.8M7.1 2.4h1.8M6.6 12.4h2.8M7.1 13.6h1.8"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Props = {
  disabled?: boolean;
};

export function TimelineModeToggles({ disabled }: Props) {
  const autoSnapping = useTimelineInteractionPrefs((s) => s.autoSnapping);
  const toggleAutoSnapping = useTimelineInteractionPrefs(
    (s) => s.toggleAutoSnapping,
  );

  return (
    <div
      className="flex items-center gap-0.5"
      data-testid="timeline-mode-toggles"
    >
      <ToggleButton
        testId="timeline-toggle-snap"
        pressed={autoSnapping}
        disabled={disabled}
        label="Auto snapping"
        title={
          autoSnapping
            ? "Turn off auto snapping (N)"
            : "Turn on auto snapping (N)"
        }
        onClick={toggleAutoSnapping}
      >
        <SnapIcon />
      </ToggleButton>
    </div>
  );
}
