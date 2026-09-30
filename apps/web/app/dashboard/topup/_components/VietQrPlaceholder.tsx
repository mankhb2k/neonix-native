import { QrCode } from "lucide-react";

export type VietQrPlaceholderProps = {
  amountLabel: string;
  title: string;
  comingSoonLabel: string;
  description: string;
};

/**
 * Placeholder for the VND bank-transfer QR method. Swap the icon block below
 * for a real dynamic QR renderer (e.g. a VietQR payload encoded as an SVG/PNG
 * for `amountLabel`) once that integration exists — the surrounding card,
 * copy, and "coming soon" badge can stay as-is.
 */
export function VietQrPlaceholder({ amountLabel, title, comingSoonLabel, description }: VietQrPlaceholderProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-4 py-4">
      <span className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--hub-border)] bg-[var(--hub-content-bg)] text-[var(--fg-disabled)]">
        <QrCode className="size-7" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-[var(--fg-primary)]">{title}</span>
          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-caption font-semibold text-[var(--hub-accent)]">
            {comingSoonLabel}
          </span>
        </div>
        <p className="mt-1 text-caption text-[var(--fg-muted)]">{description}</p>
        <p className="mt-1 font-mono text-caption text-[var(--fg-secondary)]">{amountLabel}</p>
      </div>
    </div>
  );
}
