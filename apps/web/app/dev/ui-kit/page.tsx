import { Copy, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import {
  Avatar,
  Button,
  Dropdown,
  Panel,
  Tabs,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui";
import type { ReactNode } from "react";

export const metadata = {
  title: "UI kit",
};

const BUTTON_VARIANTS: ButtonVariant[] = [
  "primary",
  "secondary",
  "ghost",
  "outline",
  "danger",
  "nav",
];
const BUTTON_SIZES: ButtonSize[] = ["sm", "md", "lg", "icon"];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4 border-b border-[var(--border-subtle)] py-10">
      <div>
        <h2 className="text-xl font-semibold text-[var(--fg-primary)]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[var(--fg-muted)]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-caption font-semibold tracking-[0.08em] text-[var(--fg-muted)] uppercase">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const NAV_ITEMS = [
  { id: "button", label: "Button" },
  { id: "dropdown", label: "Dropdown" },
  { id: "avatar", label: "Avatar" },
  { id: "panel", label: "Panel" },
  { id: "tabs", label: "Tabs" },
];

export default function UiKitPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-6 py-10">
      <nav className="sticky top-10 hidden h-fit w-40 shrink-0 space-y-1 sm:block">
        <p className="mb-2 text-caption font-semibold tracking-[0.08em] text-[var(--fg-disabled)] uppercase">
          components/ui
        </p>
        {NAV_ITEMS.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="block rounded-md px-2 py-1.5 text-sm text-[var(--fg-muted)] no-underline hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        <div className="pb-6">
          <h1 className="text-2xl font-semibold text-[var(--fg-primary)]">UI kit</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Dev-only reference for every variant and state components/ui supports. Not linked from
            any nav, not served in production.
          </p>
        </div>

        <Section id="button" title="Button" description="Variants × sizes, plus disabled and loading states.">
          <div className="space-y-5">
            {BUTTON_VARIANTS.map((variant) => (
              <Row key={variant} label={variant}>
                {BUTTON_SIZES.map((size) =>
                  size === "icon" ? (
                    <Button key={size} variant={variant} size={size} aria-label="Add">
                      <Plus className="size-4" />
                    </Button>
                  ) : (
                    <Button key={size} variant={variant} size={size}>
                      {size}
                    </Button>
                  ),
                )}
              </Row>
            ))}
            <Row label="disabled">
              <Button variant="primary" disabled>
                Disabled
              </Button>
            </Row>
            <Row label="loading">
              <Button variant="primary" loading>
                Loading
              </Button>
            </Row>
          </div>
        </Section>

        <Section id="dropdown" title="Dropdown" description="Menu-style dropdown: icons, a divider, a danger item, a disabled item, and alignment.">
          <div className="flex flex-wrap gap-6">
            <Row label="align start">
              <Dropdown
                label="Row actions"
                align="start"
                trigger={
                  <Button variant="secondary" size="icon" aria-label="Row actions (start)">
                    <MoreVertical className="size-4" />
                  </Button>
                }
                items={[
                  { label: "Rename", icon: <Pencil className="size-4" /> },
                  { label: "Duplicate", icon: <Copy className="size-4" /> },
                  { type: "divider" },
                  { label: "Archived (disabled)", disabled: true },
                  { label: "Delete", icon: <Trash2 className="size-4" />, danger: true },
                ]}
              />
            </Row>
            <Row label="align end">
              <Dropdown
                label="Row actions"
                align="end"
                trigger={
                  <Button variant="secondary" size="icon" aria-label="Row actions (end)">
                    <MoreVertical className="size-4" />
                  </Button>
                }
                items={[
                  { label: "Rename", icon: <Pencil className="size-4" /> },
                  { type: "divider" },
                  { label: "Delete", icon: <Trash2 className="size-4" />, danger: true },
                ]}
              />
            </Row>
          </div>
        </Section>

        <Section id="avatar" title="Avatar" description="Sizes, image fallback to initials, and no-name fallback.">
          <Row label="sizes (initials)">
            <Avatar name="Neonix Demo" size="sm" />
            <Avatar name="Neonix Demo" size="md" />
            <Avatar name="Neonix Demo" size="lg" />
          </Row>
          <Row label="with image">
            <Avatar src="/neonix-logo.svg" name="Neonix Demo" size="lg" />
          </Row>
          <Row label="no name (fallback)">
            <Avatar size="md" />
          </Row>
        </Section>

        <Section id="panel" title="Panel" description="Title only, title with actions, and no title.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Panel title="Title only" className="h-40">
              <p className="text-sm text-[var(--fg-muted)]">Body content.</p>
            </Panel>
            <Panel
              title="With actions"
              actions={
                <Button variant="ghost" size="icon" aria-label="Add">
                  <Plus className="size-4" />
                </Button>
              }
              className="h-40"
            >
              <p className="text-sm text-[var(--fg-muted)]">Body content.</p>
            </Panel>
            <Panel className="h-40">
              <p className="text-sm text-[var(--fg-muted)]">No header — title omitted.</p>
            </Panel>
          </div>
        </Section>

        <Section id="tabs" title="Tabs" description="Three items, second selected by default.">
          <Panel className="h-56">
            <Tabs
              defaultValue="b"
              items={[
                { id: "a", label: "First", content: <p className="p-3 text-sm">First tab content.</p> },
                { id: "b", label: "Second", content: <p className="p-3 text-sm">Second tab content (default).</p> },
                { id: "c", label: "Third", content: <p className="p-3 text-sm">Third tab content.</p> },
              ]}
            />
          </Panel>
        </Section>
      </div>
    </div>
  );
}
