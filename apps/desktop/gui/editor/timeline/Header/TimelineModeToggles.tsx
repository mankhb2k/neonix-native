/**
 * CapCut timeline mode toggles — magnet (P) · snap (N) · linkage (~).
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

/** CapCut: two blocks + left arrow (main-track magnet). */
function MagnetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="8.5" y="4.5" width="5" height="3.2" rx="0.8" fill="currentColor" />
      <rect x="8.5" y="8.3" width="5" height="3.2" rx="0.8" fill="currentColor" />
      <path
        d="M7.2 8H3.6m0 0l1.6-1.5M3.6 8l1.6 1.5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

/** CapCut: chain / linkage. */
function LinkageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6.2 9.2a2.4 2.4 0 0 1 0-3.4l1.5-1.5a2.4 2.4 0 1 1 3.4 3.4L10 8.8"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      <path
        d="M9.8 6.8a2.4 2.4 0 0 1 0 3.4L8.3 11.7a2.4 2.4 0 1 1-3.4-3.4L6 7.2"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Props = {
  disabled?: boolean;
};

export function TimelineModeToggles({ disabled }: Props) {
  const mainTrackMagnet = useTimelineInteractionPrefs((s) => s.mainTrackMagnet);
  const autoSnapping = useTimelineInteractionPrefs((s) => s.autoSnapping);
  const linkage = useTimelineInteractionPrefs((s) => s.linkage);
  const toggleMainTrackMagnet = useTimelineInteractionPrefs(
    (s) => s.toggleMainTrackMagnet,
  );
  const toggleAutoSnapping = useTimelineInteractionPrefs(
    (s) => s.toggleAutoSnapping,
  );
  const toggleLinkage = useTimelineInteractionPrefs((s) => s.toggleLinkage);

  return (
    <div
      className="flex items-center gap-0.5"
      data-testid="timeline-mode-toggles"
    >
      <ToggleButton
        testId="timeline-toggle-magnet"
        pressed={mainTrackMagnet}
        disabled={disabled}
        label="Main track magnet"
        title={
          mainTrackMagnet
            ? "Turn off main track magnet (P)"
            : "Turn on main track magnet (P)"
        }
        onClick={toggleMainTrackMagnet}
      >
        <MagnetIcon />
      </ToggleButton>

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

      <ToggleButton
        testId="timeline-toggle-linkage"
        pressed={linkage}
        disabled={disabled}
        label="Linkage"
        title={linkage ? "Turn off linkage (~)" : "Turn on linkage (~)"}
        onClick={toggleLinkage}
      >
        <LinkageIcon />
      </ToggleButton>
    </div>
  );
}
