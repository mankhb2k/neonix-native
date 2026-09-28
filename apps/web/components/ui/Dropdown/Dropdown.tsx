"use client";

import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/utils";
import type { ReactElement, ReactNode } from "react";

export type DropdownItem =
  | { type: "divider" }
  | {
      type?: "item";
      label: string;
      icon?: ReactNode;
      trailingIcon?: ReactNode;
      danger?: boolean;
      disabled?: boolean;
      onSelect?: () => void;
    };

export type DropdownProps = {
  trigger: ReactElement;
  items: DropdownItem[];
  align?: "start" | "end";
  label?: string;
  menuClassName?: string;
};

export function Dropdown({ trigger, items, align = "start", label, menuClassName }: DropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          collisionPadding={8}
          aria-label={label}
          className={cn(
            "z-50 min-w-48 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-site)] p-1 shadow-[0_18px_50px_rgba(15,23,42,0.18)]",
            menuClassName,
          )}
        >
          {items.map((item, index) =>
            item.type === "divider" ? (
              // eslint-disable-next-line react/no-array-index-key
              <DropdownMenu.Separator key={`divider-${index}`} className="my-1 border-t border-[var(--border-subtle)]" />
            ) : (
              <DropdownMenu.Item
                key={item.label}
                disabled={item.disabled}
                onSelect={() => item.onSelect?.()}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium outline-none transition-colors",
                  item.danger
                    ? "text-[var(--danger)] data-[highlighted]:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]"
                    : "text-[var(--fg-primary)] data-[highlighted]:bg-[var(--bg-hover)]",
                  item.disabled && "cursor-not-allowed opacity-40",
                )}
              >
                {item.icon ? <span className="shrink-0 text-[var(--fg-muted)]">{item.icon}</span> : null}
                <span className="flex-1 truncate">{item.label}</span>
                {item.trailingIcon ? <span className="shrink-0">{item.trailingIcon}</span> : null}
              </DropdownMenu.Item>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
