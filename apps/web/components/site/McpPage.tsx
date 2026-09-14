"use client";

import {
  ArrowRight,
  Check,
  Copy,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MCP_CLIENTS, MCP_ENDPOINT, type McpClient, type McpClientSlug } from "@/lib/mcp/clients";

export { MCP_CLIENTS } from "@/lib/mcp/clients";
export type { McpClient, McpClientSlug } from "@/lib/mcp/clients";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copyValue}
      aria-label={`Copy ${label}`}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-sm font-semibold text-[var(--fg-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--fg-primary)]"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-[var(--accent)]" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ClientCard({ client }: { client: McpClient }) {
  const Icon = client.Icon;

  return (
    <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_14px_35px_rgba(8,126,139,0.1)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-hover)]"
            style={{ color: client.accent }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--fg-primary)]">
              {client.name}
            </h2>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">OAuth client</p>
          </div>
        </div>
        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-sm font-semibold text-[var(--accent-text)]">
          Available
        </span>
      </div>

      <p className="mt-5 min-h-12 text-sm leading-6 text-[var(--fg-secondary)]">
        {client.description}
      </p>

      <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-site)] p-3">
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
          Client ID
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <code className="min-w-0 truncate text-sm text-[var(--fg-secondary)]">
            {client.clientId}
          </code>
          <CopyButton value={client.clientId} label={`${client.name} client ID`} />
        </div>
      </div>
    </article>
  );
}

const TOOL_GROUPS = [
  {
    title: "Workspace & projects",
    description: "Find workspaces, create projects, edit revisions, and open the Neonix editor.",
    tools: ["list_workspaces", "list_projects", "get_project", "create_project", "update_project", "delete_project", "open_editor"],
  },
  {
    title: "HTML authoring",
    description: "Use complete HTML/CSS as the high-level authoring source for a project.",
    tools: ["get_capabilities", "validate_html", "compile_html", "create_project_html", "get_project_html", "update_project_html", "list_html_revisions", "get_html_revision"],
  },
  {
    title: "Protocol JSON",
    description: "Inspect canonical Protocol V2 and apply a small validated JSON patch when needed.",
    tools: ["get_project_json", "apply_json_patch"],
  },
  {
    title: "Assets",
    description: "List, upload, import, attach, and safely remove workspace media assets.",
    tools: ["list_assets", "request_asset_upload", "complete_asset_upload", "import_asset", "attach_asset_to_project", "delete_asset"],
  },
  {
    title: "Export jobs",
    description: "Create an export from a saved revision, follow its status, and retrieve the result.",
    tools: ["create_export", "get_export", "get_export_download_url", "cancel_export"],
  },
] as const;

export function McpPage() {
  const endpoint = MCP_ENDPOINT;

  return (
    <main className="min-h-screen bg-[var(--bg-site)] text-[var(--fg-primary)]">
      <section className="mx-auto max-w-[1200px] px-6 pb-24 pt-10 sm:pb-32 sm:pt-16">
        <section id="what-is-mcp" className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-8">
            <div>
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">What is MCP?</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] text-[var(--fg-primary)]">A standard bridge between an AI client and Neonix.</h2>
            </div>
            <div className="space-y-4 text-base leading-7 text-[var(--fg-secondary)]">
              <p>Model Context Protocol lets a compatible AI client discover structured tools and call them with validated inputs. Instead of asking an agent to print a large JSON file in chat, Neonix lets it work with a real project through a controlled remote connection.</p>
              <p>Neonix remains responsible for authentication, workspace ownership, revisions, Protocol V2 validation, preview, and export. The agent supplies intent; Neonix keeps the project safe and editable.</p>
              <p className="pt-1 font-mono text-sm text-[var(--fg-muted)]">
                Streamable HTTP / OAuth / Protocol V2 / Preview and export
              </p>
            </div>
          </div>
        </section>

        <section id="connect" className="mx-auto mt-20 max-w-5xl rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-5 shadow-[0_28px_80px_rgba(16,24,40,0.1)] sm:p-8">
          <div className="flex flex-col gap-5 border-b border-[var(--border-subtle)] pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">Get started</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-[var(--fg-primary)] sm:text-3xl">Add the remote server to your client.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--fg-secondary)]">No local renderer or package is required. Connect to the URL, sign in with your Neonix account when OAuth opens, and approve access to the workspace you want the client to use.</p>
            </div>
            <div className="w-full sm:max-w-sm">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                Hosted MCP endpoint
              </p>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-site)] px-3 py-2">
                <code className="min-w-0 truncate text-sm text-[var(--fg-secondary)]">
                  {endpoint}
                </code>
                <CopyButton value={endpoint} label="MCP endpoint" />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 text-sm text-[var(--fg-secondary)] md:grid-cols-3">
            {[
              ["01", "Use a remote MCP client", "Choose a host that supports Streamable HTTP MCP connections."],
              ["02", "Authorize Neonix", "OAuth connects the client to your account and workspace permissions."],
              ["03", "Start with a project", "Ask the agent to create an HTML or Protocol V2 project."],
            ].map(([number, title, body]) => (
              <div key={number} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-site)] p-4">
                <span className="font-mono text-sm font-semibold text-[var(--accent-text)]">{number}</span>
                <h3 className="mt-4 font-semibold text-[var(--fg-primary)]">{title}</h3>
                <p className="mt-2 leading-6">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="clients" className="mx-auto mt-20 max-w-5xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">Supported clients</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[var(--fg-primary)]">Use the client your team already has.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[var(--fg-muted)]">These OAuth registrations are ready for Neonix&apos;s hosted MCP connection. The endpoint remains the same for every client.</p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {MCP_CLIENTS.map((client) => (
              <ClientCard key={client.name} client={client} />
            ))}
          </div>
        </section>

        <section id="tools" className="mx-auto mt-20 max-w-5xl">
          <div className="max-w-3xl">
            <p className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">Tools</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[var(--fg-primary)] sm:text-4xl">Everything an agent needs to move from intent to export.</h2>
            <p className="mt-4 text-base leading-7 text-[var(--fg-secondary)]">The remote server exposes focused tools instead of one opaque generate call. Each operation is authenticated, validated, and scoped to the user&apos;s workspace.</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {TOOL_GROUPS.map((group) => (
              <article key={group.title} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
                <h3 className="text-lg font-semibold text-[var(--fg-primary)]">{group.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--fg-secondary)]">{group.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.tools.map((tool) => (
                    <code key={tool} className="rounded-md bg-[var(--bg-hover)] px-2 py-1 font-mono text-sm text-[var(--accent-text)]">{tool}</code>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="mx-auto mt-20 max-w-5xl rounded-2xl border border-[var(--border-strong)] bg-[#101522] p-6 text-[#e2e8f4] sm:p-8">
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-[#6ee7d0]">Recommended workflow</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-white">Start high-level, keep the source and revision history clear.</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              ["Create", "For an HTML-first request, call get_capabilities, prepare a complete neonix-document, then use create_project_html."],
              ["Edit", "Read with get_project_html, preserve the document metadata, validate with validate_html, then save with update_project_html."],
              ["Ship", "Open the editor with open_editor, create an export from a saved revision, and retrieve the signed download URL when ready."],
            ].map(([title, body]) => (
              <div key={title}>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#aeb8ca]">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-xl border border-white/10 bg-[#0a0e18] p-4 font-mono text-sm leading-6 text-[#d7e1f0]">
            <p>get_capabilities → create_project_html → open_editor</p>
            <p>get_project_html → validate_html → update_project_html</p>
            <p>create_export → get_export → get_export_download_url</p>
          </div>
        </section>

        <section id="resources" className="mx-auto mt-20 max-w-5xl">
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent-text)]">Resources</p>
              <h2 className="mt-3 text-xl font-semibold text-[var(--fg-primary)]">Guidance available to the host</h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--fg-secondary)]">
                <p><code className="font-mono text-sm text-[var(--accent-text)]">neonix://docs/workflows</code> — recommended create, edit, asset, and export flows.</p>
                <p><code className="font-mono text-sm text-[var(--accent-text)]">neonix://docs/html-authoring</code> — supported HTML/CSS boundary and Protocol V2 rules.</p>
              </div>
            </article>
            <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent-text)]">Prompts</p>
              <h2 className="mt-3 text-xl font-semibold text-[var(--fg-primary)]">Reusable workflow starters</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {["create_html_project", "edit_html_project"].map((prompt) => (
                  <code key={prompt} className="rounded-md bg-[var(--bg-hover)] px-2 py-1 font-mono text-sm text-[var(--accent-text)]">{prompt}</code>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--fg-secondary)]">Compatible hosts can attach these prompts and resources to give the agent the Neonix workflow before it calls a tool.</p>
            </article>
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-5xl border-t border-[var(--border-subtle)] pt-8">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent-text)]">Important boundaries</p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--fg-secondary)]">
                <li>HTML is the preferred high-level authoring source for HTML requests; Protocol V2 JSON remains canonical.</li>
                <li>Exports run from saved revisions, not unsaved arbitrary JSON supplied in a tool call.</li>
                <li>Destructive actions such as delete_project, delete_asset, and cancel_export should be confirmed first.</li>
              </ul>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent-text)]">Continue</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/docs/mcp/claude" className="text-sm font-semibold text-[var(--accent-text)] no-underline hover:text-[var(--accent)]">Claude setup <ArrowRight className="inline h-4 w-4" /></Link>
                <Link href="/docs/mcp/chatgpt" className="text-sm font-semibold text-[var(--accent-text)] no-underline hover:text-[var(--accent)]">ChatGPT setup <ArrowRight className="inline h-4 w-4" /></Link>
                <Link href="/docs/mcp/grok" className="text-sm font-semibold text-[var(--accent-text)] no-underline hover:text-[var(--accent)]">Grok setup <ArrowRight className="inline h-4 w-4" /></Link>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

export function McpClientPage({ slug }: { slug: McpClientSlug }) {
  const client = MCP_CLIENTS.find((entry) => entry.slug === slug);
  if (!client) return null;

  const Icon = client.Icon;

  return (
    <main className="min-h-screen bg-[var(--bg-site)] text-[var(--fg-primary)]">
      <section className="mx-auto max-w-[1100px] px-6 pb-20 pt-16 sm:pb-28 sm:pt-24">
        <Link
          href="/docs/mcp"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-text)] no-underline hover:text-[var(--accent)]"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
          MCP connections
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div>
            <div className="flex items-center gap-3">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-elevated)] shadow-sm"
                style={{ color: client.accent }}
              >
                <Icon className="h-6 w-6" />
              </span>
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">
                {client.name} / MCP
              </p>
            </div>
            <h1 className="mt-7 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-[var(--fg-primary)] sm:text-6xl">
              Connect {client.name}
              <br />
              <span className="text-[var(--accent-text)]">to Neonix.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--fg-secondary)]">
              {client.description} Use the hosted MCP server to create,
              update, preview, and export editable motion projects from your
              {" "}
              {client.name} workflow.
            </p>
          </div>

          <section className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-5 shadow-[0_20px_60px_rgba(16,24,40,0.08)] sm:p-6">
            <p className="font-mono text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent-text)]">
              Connection details
            </p>
            <div className="mt-6 space-y-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                  MCP endpoint
                </p>
                <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-site)] px-3 py-2">
                  <code className="min-w-0 truncate text-sm text-[var(--fg-secondary)]">
                    {MCP_ENDPOINT}
                  </code>
                  <CopyButton value={MCP_ENDPOINT} label="MCP endpoint" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                  OAuth client ID
                </p>
                <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-site)] px-3 py-2">
                  <code className="min-w-0 truncate text-sm text-[var(--fg-secondary)]">
                    {client.clientId}
                  </code>
                  <CopyButton value={client.clientId} label={`${client.name} client ID`} />
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-14 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 sm:p-8">
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent-text)]">
            Setup flow
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {[
              ["01", "Open your client", `Start a new MCP connection in ${client.name}.`],
              ["02", "Add Neonix", "Use the hosted endpoint and complete OAuth authorization."],
              ["03", "Create motion", "Ask your agent to create or update an editable project."],
            ].map(([number, title, body]) => (
              <div key={number}>
                <span className="font-mono text-sm font-semibold text-[var(--accent-text)]">
                  {number}
                </span>
                <h2 className="mt-4 text-lg font-semibold text-[var(--fg-primary)]">
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--fg-secondary)]">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
