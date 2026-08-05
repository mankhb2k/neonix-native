import { appUrl } from "@/lib/hosts";
import { APP_NAME } from "@motionvideo/shared";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MotionVideo — TVC motion 2D cho doanh nghiệp Việt",
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
      <a href={appUrl("/")} className="mv-btn mv-btn-primary">
        Mở app
      </a>
    </main>
  );
}
