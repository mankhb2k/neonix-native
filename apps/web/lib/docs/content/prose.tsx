import type { ReactNode } from "react";

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="my-4 text-[15px] leading-7 text-[var(--fg-primary)]">
      {children}
    </p>
  );
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-10 mb-3 text-xl font-semibold tracking-tight">
      {children}
    </h2>
  );
}

export function DocsTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="my-6 overflow-x-auto rounded-xl border border-[var(--border-subtle,#e4e4e7)]">
      <table className="w-full text-left text-[14px]">
        <thead className="bg-[var(--bg-surface)] text-[12px] uppercase tracking-wide text-[var(--fg-muted)]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-t border-[var(--border-subtle,#e4e4e7)]"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
