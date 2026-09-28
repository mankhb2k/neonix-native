// Hand-drawn flag swatches instead of flag emoji: emoji flags (regional
// indicator sequences) don't render as pictures on every platform/browser
// combo — Windows Chromium in particular falls back to plain "US"/"VN" text.
// These small CSS/SVG shapes render identically everywhere.

export function UsFlagIcon() {
  return (
    <span
      className="relative inline-flex h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px] align-middle"
      style={{ background: "repeating-linear-gradient(to bottom, #B22234 0 2px, #ffffff 2px 4px)" }}
      aria-hidden="true"
    >
      <span className="absolute left-0 top-0 h-[7px] w-2 bg-[#3C3B6E]" />
    </span>
  );
}

export function VnFlagIcon() {
  return (
    <span
      className="inline-flex h-3.5 w-5 shrink-0 items-center justify-center rounded-[2px] bg-[#DA251D] align-middle text-[9px] leading-none text-[#FFCD00]"
      aria-hidden="true"
    >
      ★
    </span>
  );
}
