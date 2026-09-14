"use client";

import { ArrowUpRight, Check, Copy, Link2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { dashboardHref } from "@/components/AppLink";
import { MCP_CLIENTS, MCP_ENDPOINT, type McpClient, type McpClientSlug } from "@/lib/mcp/clients";

const SETUP_STEPS: Record<McpClientSlug, string[]> = {
  claude: [
    "Open Claude settings and find Connectors.",
    "Add a remote MCP server using the Neonix endpoint.",
    "Complete OAuth, then approve Neonix workspace access.",
  ],
  chatgpt: [
    "Open ChatGPT settings and find Apps or Connectors.",
    "Add Neonix as a remote MCP connection.",
    "Complete OAuth, then approve Neonix workspace access.",
  ],
  grok: [
    "Open Grok settings and find MCP connections.",
    "Add a remote server with the Neonix endpoint.",
    "Complete OAuth, then approve Neonix workspace access.",
  ],
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copyValue}
      aria-label={`Copy ${label}`}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--hub-border)] px-2.5 py-1.5 text-caption font-semibold text-[var(--fg-secondary)] transition hover:border-[var(--hub-accent)] hover:text-[var(--fg-primary)]"
    >
      {copied ? <Check className="size-3.5 text-[var(--hub-accent)]" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ProviderCard({ client }: { client: McpClient }) {
  const Icon: LucideIcon = client.Icon;

  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--hub-content-bg)]"
            style={{ color: client.accent }}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-[var(--fg-primary)]">{client.name}</h2>
            <p className="text-caption text-[var(--fg-muted)]">OAuth connection</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-1 text-caption font-semibold text-[var(--hub-accent)]">
          Available
        </span>
      </div>

      <p className="mt-5 min-h-10 text-sm leading-5 text-[var(--fg-muted)]">{client.description}</p>

      <div className="mt-5 border-t border-[var(--hub-border)] pt-4">
        <p className="text-caption font-semibold uppercase tracking-[0.12em] text-[var(--fg-disabled)]">
          Connect in 3 steps
        </p>
        <ol className="mt-3 space-y-3">
          {SETUP_STEPS[client.slug].map((step, index) => (
            <li key={step} className="flex gap-3 text-sm leading-5 text-[var(--fg-secondary)]">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-caption font-semibold text-[var(--hub-accent)]">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-5 rounded-lg bg-[var(--hub-content-bg)] p-3">
        <p className="text-caption font-semibold uppercase tracking-[0.12em] text-[var(--fg-disabled)]">
          OAuth client ID
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <code className="min-w-0 truncate font-mono text-caption text-[var(--fg-secondary)]">{client.clientId}</code>
          <CopyButton value={client.clientId} label={`${client.name} client ID`} />
        </div>
      </div>

      <Link
        href={dashboardHref(`/docs/mcp/${client.slug}`)}
        className="mt-5 inline-flex items-center gap-1.5 text-body font-semibold text-[var(--hub-accent)] no-underline hover:underline"
      >
        Open setup guide
        <ArrowUpRight className="size-3.5" />
      </Link>
    </article>
  );
}

export function McpWorkspace() {
  const clients = [...MCP_CLIENTS].sort((a, b) => {
    const order = ["claude", "chatgpt", "grok"];
    return order.indexOf(a.slug) - order.indexOf(b.slug);
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-caption font-semibold uppercase tracking-[0.16em] text-[var(--hub-accent)]">
            Connect
          </p>
          <h1 className="m-0 text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)] sm:text-4xl">
            MCP
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--fg-muted)]">
            Connect Claude, ChatGPT, or Grok to your Neonix workspace through one
            authenticated remote MCP server.
          </p>
        </div>
        <Link
          href={dashboardHref("/docs/mcp")}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-4 py-2.5 text-body font-semibold text-[var(--fg-primary)] no-underline transition hover:border-[var(--hub-accent)] hover:bg-[var(--hub-hover)]"
        >
          Read MCP docs
          <ArrowUpRight className="size-4" />
        </Link>
      </div>

      <section className="rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] p-6 shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--hub-accent)]">
              <Link2 className="size-5" />
            </span>
            <div>
              <p className="text-caption font-semibold uppercase tracking-[0.14em] text-[var(--hub-accent)]">
                One remote connection
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[var(--fg-primary)]">
                Hosted MCP endpoint
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--fg-muted)]">
                Add this URL to any supported provider. OAuth will open when the
                provider connects for the first time.
              </p>
            </div>
          </div>
          <div className="flex w-full items-center justify-between gap-3 rounded-lg bg-[var(--hub-content-bg)] px-3 py-2 lg:max-w-md">
            <code className="min-w-0 truncate font-mono text-caption text-[var(--fg-secondary)]">{MCP_ENDPOINT}</code>
            <CopyButton value={MCP_ENDPOINT} label="MCP endpoint" />
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4 border-b border-[var(--hub-border)] pb-3">
          <div>
            <p className="text-caption font-semibold uppercase tracking-[0.14em] text-[var(--hub-accent)]">
              Supported providers
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[var(--fg-primary)]">
              Choose your AI client
            </h2>
          </div>
          <span className="text-caption text-[var(--fg-muted)]">{clients.length} available</span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <ProviderCard key={client.slug} client={client} />
          ))}
        </div>
      </section>
    </div>
  );
}
