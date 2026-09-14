"use client";

import { Bell, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { submitApiWaitlist } from "@/lib/api/waitlist";

export function ApiWorkspace() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    try {
      const result = await submitApiWaitlist(email);
      setStatus("success");
      setMessage(result.message);
      setEmail("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "We could not save your email. Please try again.");
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center py-12">
      <div className="w-full max-w-xl">
        <section className="rounded-2xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] p-8 shadow-sm sm:p-10">
          <div className="flex size-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--hub-accent)]">
            <Bell className="size-6" />
          </div>
          <p className="mt-8 text-caption font-semibold uppercase tracking-[0.16em] text-[var(--hub-accent)]">
            Coming soon
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)] sm:text-4xl">
            The Neonix API is on its way.
          </h1>
          <p className="mt-4 text-sm leading-6 text-[var(--fg-muted)]">
            We are preparing a simple way to build, update, and render editable
            motion projects from your own tools. Leave your email and we will
            notify you when API access is available.
          </p>

          <form className="mt-8" onSubmit={handleSubmit}>
            <label htmlFor="api-waitlist-email" className="text-body font-medium text-[var(--fg-primary)]">
              Email address
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
                <input
                  id="api-waitlist-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-lg border border-[var(--hub-border)] bg-[var(--hub-content-bg)] pl-10 pr-3 text-body text-[var(--fg-primary)] outline-none transition placeholder:text-[var(--fg-disabled)] focus:border-[var(--hub-accent)]"
                />
              </div>
              <button
                type="submit"
                disabled={status === "submitting"}
                className="h-11 rounded-lg bg-[var(--hub-accent)] px-5 text-body font-semibold text-[var(--hub-accent-on)] transition hover:bg-[var(--hub-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "submitting" ? "Saving…" : "Notify me"}
              </button>
            </div>
            <p
              aria-live="polite"
              className={`mt-3 min-h-5 text-body ${status === "error" ? "text-red-600" : "text-[var(--fg-muted)]"}`}
            >
              {message}
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
