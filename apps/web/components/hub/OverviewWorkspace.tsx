import { Clock, CreditCard, Film, Wallet } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { ExportsTrendChart } from "@/components/hub/charts/ExportsTrendChart";

// Mock usage data — replace with real billing/usage once metering is wired up.
const MOCK_USAGE = {
  videosExported: 128,
  unitPriceUsd: 0.15,
  totalDurationSeconds: 7684,
  balanceUsd: 12.4,
};

// Mock daily export counts for the last 14 days (oldest first) — replace with
// real usage once metering is wired up.
const MOCK_DAILY_EXPORTS = [3, 5, 4, 7, 6, 8, 5, 9, 7, 10, 8, 11, 9, 13];

// Mock per-video duration for the most recent exports — replace with real
// per-render metrics once metering is wired up.
const MOCK_RECENT_VIDEOS = [
  { title: "Three Kingdoms", durationSeconds: 42 },
  { title: "Shape composition", durationSeconds: 18 },
  { title: "Overlap study", durationSeconds: 25 },
  { title: "Timeline prototype", durationSeconds: 61 },
];

function formatDurationSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${paddedMinutes}:${paddedSeconds}` : `${minutes}:${paddedSeconds}`;
}

export async function OverviewWorkspace() {
  const t = await getTranslations("OverviewWorkspace");
  const format = await getFormatter();

  const today = new Date();
  const trendData = MOCK_DAILY_EXPORTS.map((value, index) => {
    const daysAgo = MOCK_DAILY_EXPORTS.length - 1 - index;
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    return {
      label: format.dateTime(date, { month: "short", day: "numeric" }),
      value,
    };
  });

  const totalCostUsd = MOCK_USAGE.videosExported * MOCK_USAGE.unitPriceUsd;
  const unitPriceLabel = format.number(MOCK_USAGE.unitPriceUsd, { style: "currency", currency: "USD" });
  const totalCostLabel = format.number(totalCostUsd, { style: "currency", currency: "USD" });

  const balanceLabel = format.number(MOCK_USAGE.balanceUsd, { style: "currency", currency: "USD" });

  const statCards = [
    { label: t("stats.videosExported"), value: format.number(MOCK_USAGE.videosExported), icon: Film },
    {
      label: t("stats.totalDuration"),
      value: t("stats.totalDurationValue", { seconds: format.number(MOCK_USAGE.totalDurationSeconds) }),
      caption: formatDurationSeconds(MOCK_USAGE.totalDurationSeconds),
      icon: Clock,
    },
    { label: t("stats.totalCost"), value: totalCostLabel, icon: CreditCard },
    { label: t("stats.balance"), value: balanceLabel, icon: Wallet },
  ];

  return (
    <div>
      <div>
        <p className="mb-2 text-caption font-semibold tracking-[0.16em] text-[var(--hub-accent)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="m-0 text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)] sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--fg-muted)]">
          {t("description")}
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-caption text-[var(--fg-muted)]">{card.label}</span>
                <Icon className="size-4 text-[var(--hub-accent)]" />
              </div>
              <p className="mt-2 m-0 font-mono text-xl font-semibold text-[var(--fg-primary)]">{card.value}</p>
              {"caption" in card ? (
                <p className="mt-0.5 font-mono text-caption text-[var(--fg-muted)]">{card.caption}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <ExportsTrendChart
          data={trendData}
          title={t("trend.title")}
          description={t("trend.description")}
          valueLabel={t("trend.valueLabel")}
          dateLabel={t("trend.dateLabel")}
          showTableLabel={t("trend.showTable")}
          showChartLabel={t("trend.showChart")}
        />
      </div>

      <section className="mt-8">
        <p className="text-caption font-semibold uppercase tracking-[0.14em] text-[var(--hub-accent)]">
          {t("durations.title")}
        </p>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--fg-muted)]">
          {t("durations.description")}
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)]">
          <div className="grid grid-cols-3 gap-3 border-b border-[var(--hub-border)] px-5 py-3 text-caption font-semibold uppercase tracking-[0.08em] text-[var(--fg-muted)]">
            <span>{t("durations.columns.video")}</span>
            <span>{t("durations.columns.duration")}</span>
            <span>{t("durations.columns.seconds")}</span>
          </div>
          <div className="divide-y divide-[var(--hub-divider)]">
            {MOCK_RECENT_VIDEOS.map((video) => (
              <div key={video.title} className="grid grid-cols-3 gap-3 px-5 py-3 text-body text-[var(--fg-primary)]">
                <span className="truncate font-medium">{video.title}</span>
                <span className="font-mono">{formatDurationSeconds(video.durationSeconds)}</span>
                <span className="font-mono text-[var(--fg-secondary)]">{video.durationSeconds}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <p className="text-caption font-semibold uppercase tracking-[0.14em] text-[var(--hub-accent)]">
          {t("breakdown.title")}
        </p>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--fg-muted)]">
          {t("breakdown.description")}
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)]">
          <div className="grid grid-cols-4 gap-3 border-b border-[var(--hub-border)] px-5 py-3 text-caption font-semibold uppercase tracking-[0.08em] text-[var(--fg-muted)]">
            <span>{t("breakdown.columns.item")}</span>
            <span>{t("breakdown.columns.quantity")}</span>
            <span>{t("breakdown.columns.unitPrice")}</span>
            <span>{t("breakdown.columns.subtotal")}</span>
          </div>
          <div className="grid grid-cols-4 gap-3 px-5 py-4 font-mono text-body text-[var(--fg-primary)]">
            <span className="font-sans font-medium">{t("breakdown.rowLabel")}</span>
            <span>{format.number(MOCK_USAGE.videosExported)}</span>
            <span>{unitPriceLabel}</span>
            <span>{totalCostLabel}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
