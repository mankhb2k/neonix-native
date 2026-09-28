"use client";

import { CreditCard, Landmark, Wallet } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { UsFlagIcon, VnFlagIcon } from "@/components/hub/topup/CurrencyFlags";
import { VietQrPlaceholder } from "@/components/hub/topup/VietQrPlaceholder";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Currency = "USD" | "VND";

const AMOUNTS: Record<Currency, number[]> = {
  USD: [2, 5, 10, 20, 50, 100, 500],
  VND: [10000, 20000, 50000, 100000, 200000, 500000, 1000000, 2000000],
};

// Mock current balance — replace with the real wallet balance once billing is wired up.
const MOCK_BALANCE_USD = 12.4;

const USD_METHODS = [
  { id: "paypal", icon: Wallet },
  { id: "card", icon: CreditCard },
  { id: "googlepay", icon: Landmark },
] as const;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 4) return `${local.slice(0, 1)}***@${domain}`;
  return `${local.slice(0, 2)}****${local.slice(-2)}@${domain}`;
}

export function TopupWorkspace() {
  const t = useTranslations("TopupWorkspace");
  const format = useFormatter();
  const [currency, setCurrency] = useState<Currency>("USD");
  const [selectedAmount, setSelectedAmount] = useState<number>(AMOUNTS.USD[0]);
  const [isCustom, setIsCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<string>("paypal");
  const [showNotice, setShowNotice] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadAccount() {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (mounted && user?.email) setEmail(user.email);
      } catch {
        // Keep the placeholder when auth is unavailable during local boot.
      }
    }
    void loadAccount();
    return () => {
      mounted = false;
    };
  }, []);

  function selectCurrency(next: Currency) {
    setCurrency(next);
    setIsCustom(false);
    setSelectedAmount(AMOUNTS[next][0]);
    setShowNotice(false);
  }

  const total = isCustom ? Number.parseFloat(customAmount) || 0 : selectedAmount;
  const totalLabel = format.number(total, { style: "currency", currency });

  return (
    <div className="mx-auto max-w-3xl">
      <div>
        <p className="mb-2 text-caption font-semibold tracking-[0.16em] text-[var(--hub-accent)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="m-0 text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)] sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--fg-muted)]">{t("description")}</p>
      </div>

      <div className="mt-6 inline-flex rounded-lg border border-[var(--hub-border)] bg-[var(--hub-card-bg)] p-1">
        <button
          type="button"
          onClick={() => selectCurrency("USD")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-body font-medium transition ${currency === "USD" ? "bg-[var(--hub-active)] text-[var(--fg-primary)]" : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"}`}
        >
          <UsFlagIcon /> USD
        </button>
        <button
          type="button"
          onClick={() => selectCurrency("VND")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-body font-medium transition ${currency === "VND" ? "bg-[var(--hub-active)] text-[var(--fg-primary)]" : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"}`}
        >
          <VnFlagIcon /> VND
        </button>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-caption font-semibold text-[var(--fg-muted)]">{t("amountLabel")}</p>
        <div className="flex flex-wrap gap-2">
          {AMOUNTS[currency].map((amount) => {
            const active = !isCustom && selectedAmount === amount;
            return (
              <button
                key={amount}
                type="button"
                onClick={() => {
                  setIsCustom(false);
                  setSelectedAmount(amount);
                  setShowNotice(false);
                }}
                className={`rounded-lg px-3 py-2 text-body font-semibold transition ${active ? "bg-[var(--fg-primary)] text-[var(--bg-elevated)]" : "bg-[var(--hub-hover)] text-[var(--fg-primary)] hover:bg-[var(--hub-active)]"}`}
              >
                {format.number(amount, { style: "currency", currency, maximumFractionDigits: 0 })}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setIsCustom(true);
              setShowNotice(false);
            }}
            className={`rounded-lg px-3 py-2 text-body font-semibold transition ${isCustom ? "bg-[var(--fg-primary)] text-[var(--bg-elevated)]" : "bg-[var(--hub-hover)] text-[var(--fg-primary)] hover:bg-[var(--hub-active)]"}`}
          >
            {t("custom")}
          </button>
        </div>
        {isCustom ? (
          <input
            type="number"
            min={0}
            value={customAmount}
            onChange={(event) => setCustomAmount(event.target.value)}
            placeholder={t("customPlaceholder")}
            className="mt-3 h-11 w-full max-w-xs rounded-lg border border-[var(--hub-border)] bg-transparent px-3 text-body text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-disabled)] focus:border-[var(--hub-accent)]"
          />
        ) : null}
      </div>

      <div className="mt-6">
        <p className="text-caption font-semibold text-[var(--fg-muted)]">{t("totalLabel")}</p>
        <p className="mt-1 font-mono text-3xl font-semibold text-[var(--fg-primary)]">{totalLabel}</p>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-caption font-semibold text-[var(--fg-muted)]">{t("paymentMethodLabel")}</p>
        {currency === "USD" ? (
          <div className="space-y-2">
            {USD_METHODS.map((method) => {
              const Icon = method.icon;
              const active = selectedMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSelectedMethod(method.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${active ? "border-[var(--fg-primary)]" : "border-[var(--hub-border)] hover:border-[var(--hub-accent)]"}`}
                >
                  <Icon className="size-5 shrink-0 text-[var(--fg-secondary)]" />
                  <span className="font-medium text-[var(--fg-primary)]">{t(`methods.${method.id}`)}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <VietQrPlaceholder
            title={t("methods.vietqr")}
            comingSoonLabel={t("comingSoon")}
            description={t("vietqrDescription")}
            amountLabel={totalLabel}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowNotice(true)}
        disabled={currency === "VND" || total <= 0}
        className="mt-6 w-full rounded-lg bg-[var(--fg-primary)] py-3 text-body font-semibold text-[var(--bg-elevated)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t("nextStep")}
      </button>

      {showNotice ? (
        <p role="status" className="mt-3 rounded-lg border border-[var(--hub-border)] bg-[var(--hub-hover)] px-3.5 py-2.5 text-caption text-[var(--fg-secondary)]">
          {t("previewNotice")}
        </p>
      ) : null}

      <p className="mt-6 text-center text-caption text-[var(--fg-muted)]">
        {t("balance", { amount: format.number(MOCK_BALANCE_USD, { style: "currency", currency: "USD" }) })}
      </p>
      {email ? (
        <p className="mt-1 text-center text-caption text-[var(--fg-disabled)]">
          {t("accountNote", { email: maskEmail(email) })}
        </p>
      ) : null}
    </div>
  );
}
