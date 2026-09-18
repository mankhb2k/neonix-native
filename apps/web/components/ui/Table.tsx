import type { ComponentPropsWithoutRef } from "react";

function joinClasses(base: string, className?: string) {
  return className ? `${base} ${className}` : base;
}

export function Table({ className, ...props }: ComponentPropsWithoutRef<"table">) {
  return (
    <div className="mb-6 w-full overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
      <table
        className={joinClasses(
          "min-w-full border-separate border-spacing-0 text-sm",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentPropsWithoutRef<"thead">) {
  return <thead className={joinClasses("bg-[var(--bg-surface)]", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentPropsWithoutRef<"tbody">) {
  return (
    <tbody
      className={joinClasses(
        "bg-[var(--bg-elevated)] [&>tr:last-child>td]:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: ComponentPropsWithoutRef<"tr">) {
  return <tr className={joinClasses("group", className)} {...props} />;
}

export function TableHead({ className, ...props }: ComponentPropsWithoutRef<"th">) {
  return (
    <th
      className={joinClasses(
        "border-b border-r border-[var(--border-subtle)] px-4 py-3 text-left align-top font-semibold text-[var(--fg-primary)] first:border-l-0 last:border-r-0",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentPropsWithoutRef<"td">) {
  return (
    <td
      className={joinClasses(
        "border-b border-r border-[var(--border-subtle)] px-4 py-3 text-left align-top text-[var(--fg-secondary)] first:border-l-0 last:border-r-0",
        className,
      )}
      {...props}
    />
  );
}
