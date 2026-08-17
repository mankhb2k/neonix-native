import { appUrl } from "@/lib/hosts";
import { APP_NAME } from "@/lib/app-config";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NeonVideo — TVC motion 2D cho doanh nghiệp Việt",
  description:
    "Tạo video quảng cáo motion graphic tiếng Việt từ logo, màu brand và kịch bản.",
};

export default function MarketingHomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "4.5rem 1.5rem",
        maxWidth: 760,
        margin: "0 auto",
        background:
          "radial-gradient(ellipse 70% 45% at 20% -5%, rgba(13,148,136,0.14) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 90% 10%, rgba(2,132,199,0.1) 0%, transparent 50%)",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-display)",
          color: "var(--accent-text)",
          letterSpacing: "0.06em",
          marginBottom: "1rem",
          fontWeight: 600,
        }}
      >
        {APP_NAME}
      </p>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2.4rem, 6vw, 3.6rem)",
          lineHeight: 1.1,
          letterSpacing: "-0.03em",
          margin: "0 0 1rem",
          color: "var(--fg-primary)",
        }}
      >
        TVC motion 2D
        <br />
        cho doanh nghiệp Việt
      </h1>
      <p
        style={{
          color: "var(--fg-muted)",
          fontSize: "1.15rem",
          lineHeight: 1.65,
          maxWidth: "28rem",
          margin: "0 0 2rem",
        }}
      >
        Logo, màu brand, kịch bản tiếng Việt — ra timeline chỉnh được, không cần
        After Effects.
      </p>
      <div className="flex flex-wrap gap-3">
      <a
        href={appUrl("/")}
        className="inline-flex h-10 items-center justify-center rounded-full border border-transparent bg-[var(--accent)] px-4 font-semibold text-[var(--accent-on)] no-underline shadow-[0_6px_18px_rgba(34,211,238,0.28)] transition hover:-translate-y-px hover:bg-[var(--accent-hover)] hover:shadow-[0_8px_22px_rgba(34,211,238,0.34)]"
      >
        Mở app
      </a>
      <a
        href="/docs"
        className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--border-subtle,#e4e4e7)] bg-[var(--bg-elevated)] px-4 font-semibold text-[var(--fg-primary)] no-underline"
      >
        Docs
      </a>
      </div>
    </main>
  );
}
