"use client";

import { ShieldCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { createTopupCheckout, getWalletBalance } from "@/lib/api/billing";
import { UsFlagIcon, VnFlagIcon } from "./CurrencyFlags";
import { VietQrPlaceholder } from "./VietQrPlaceholder";

type Currency = "USD" | "VND";

const AMOUNTS: Record<Currency, number[]> = {
  USD: [2, 5, 10, 20, 50, 100, 500],
  VND: [10000, 20000, 50000, 100000, 200000, 500000, 1000000, 2000000],
};

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
  const [email, setEmail] = useState<string | null>(null);
  const [balanceUsd, setBalanceUsd] = useState<number | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [justTopped, setJustTopped] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadAccount() {
      // Keep the placeholder until the profile API is wired in.
      if (!mounted) return;
    }
    void loadAccount();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadBalance() {
      const balance = await getWalletBalance();
      if (mounted && balance) setBalanceUsd(balance.balanceUsd);
    }
    void loadBalance();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("checkout") === "success") {
        setJustTopped(true);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
    return () => {
      mounted = false;
    };
  }, []);

  function selectCurrency(next: Currency) {
    setCurrency(next);
    setIsCustom(false);
    setSelectedAmount(AMOUNTS[next][0]);
    setCheckoutError(null);
  }

  const total = isCustom ? Number.parseFloat(customAmount) || 0 : selectedAmount;
  const totalLabel = format.number(total, { style: "currency", currency });

  async function startCheckout() {
    setCheckoutError(null);
    setIsRedirecting(true);
    const result = await createTopupCheckout(total);
    if (!result) {
      setCheckoutError(t("checkoutError"));
      setIsRedirecting(false);
      return;
    }
    window.location.href = result.checkoutUrl;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div>
        <p className="mb-2 text-caption font-semibold tracking-[0.16em] text-[var(--hub-accent)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="m-0 text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)] sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-base leading-6 text-[var(--fg-muted)]">{t("description")}</p>
      </div>

      <div className="mt-6 inline-flex rounded-lg border border-[var(--hub-border)] bg-[var(--hub-card-bg)] p-1">
        <Button
          variant="ghost"
          onClick={() => selectCurrency("USD")}
          className={`h-auto px-3 py-1.5 text-body ${currency === "USD" ? "bg-[var(--hub-active)] text-[var(--fg-primary)]" : ""}`}
        >
          <UsFlagIcon /> USD
        </Button>
        <Button
          variant="ghost"
          onClick={() => selectCurrency("VND")}
          className={`h-auto px-3 py-1.5 text-body ${currency === "VND" ? "bg-[var(--hub-active)] text-[var(--fg-primary)]" : ""}`}
        >
          <VnFlagIcon /> VND
        </Button>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-caption font-semibold text-[var(--fg-muted)]">{t("amountLabel")}</p>
        <div className="flex flex-wrap gap-2">
          {AMOUNTS[currency].map((amount) => {
            const active = !isCustom && selectedAmount === amount;
            return (
              <Button
                key={amount}
                variant="secondary"
                onClick={() => {
                  setIsCustom(false);
                  setSelectedAmount(amount);
                  setCheckoutError(null);
                }}
                className={`h-auto rounded-lg border-transparent px-3 py-2 text-body font-semibold ${active ? "bg-[var(--fg-primary)] text-[var(--bg-elevated)] hover:bg-[var(--fg-primary)]" : "bg-[var(--hub-hover)] hover:bg-[var(--hub-active)]"}`}
              >
                {format.number(amount, { style: "currency", currency, maximumFractionDigits: 0 })}
              </Button>
            );
          })}
          <Button
            variant="secondary"
            onClick={() => {
              setIsCustom(true);
              setCheckoutError(null);
            }}
            className={`h-auto rounded-lg border-transparent px-3 py-2 text-body font-semibold ${isCustom ? "bg-[var(--fg-primary)] text-[var(--bg-elevated)] hover:bg-[var(--fg-primary)]" : "bg-[var(--hub-hover)] hover:bg-[var(--hub-active)]"}`}
          >
            {t("custom")}
          </Button>
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
          <div className="flex items-center gap-3 rounded-xl border border-[var(--hub-border)] px-4 py-3">
            <ShieldCheck className="size-5 shrink-0 text-[var(--fg-secondary)]" />
            <span className="font-medium text-[var(--fg-primary)]">{t("methods.polar")}</span>
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

      <Button
        variant="primary"
        onClick={() => void startCheckout()}
        disabled={currency === "VND" || total <= 0 || isRedirecting}
        className="mt-6 h-auto w-full rounded-lg bg-[var(--fg-primary)] py-3 text-body font-semibold text-[var(--bg-elevated)] hover:bg-[var(--fg-primary)] hover:opacity-90"
      >
        {isRedirecting ? t("redirecting") : t("nextStep")}
      </Button>

      {checkoutError ? (
        <p role="alert" className="mt-3 rounded-lg border border-[var(--hub-border)] bg-[var(--hub-hover)] px-3.5 py-2.5 text-caption text-[var(--fg-secondary)]">
          {checkoutError}
        </p>
      ) : null}

      {justTopped ? (
        <p role="status" className="mt-3 rounded-lg border border-[var(--hub-border)] bg-[var(--hub-hover)] px-3.5 py-2.5 text-caption text-[var(--fg-secondary)]">
          {t("topupSuccess")}
        </p>
      ) : null}

      <p className="mt-6 text-center text-caption text-[var(--fg-muted)]">
        {balanceUsd === null
          ? t("balanceLoading")
          : t("balance", { amount: format.number(balanceUsd, { style: "currency", currency: "USD" }) })}
      </p>
      {email ? (
        <p className="mt-1 text-center text-caption text-[var(--fg-disabled)]">
          {t("accountNote", { email: maskEmail(email) })}
        </p>
      ) : null}
    </div>
  );
}
