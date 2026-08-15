import type { QuickRef } from "@/lib/docs/atoms";

export function QuickReference(ref: QuickRef) {
  const rows: Array<[string, string]> = [
    ["Path", ref.path],
    ["Type", ref.type],
    ["Default", ref.defaultValue],
    ["Animatable", ref.animatable],
    ["Applies to", ref.appliesTo],
    ["Does not apply to", ref.doesNotApplyTo],
    ["Range", ref.range],
  ];
  return (
    <section id="quick-reference" className="my-8">
      <h2 className="mb-3 text-xl font-semibold tracking-tight">
        Quick Reference
      </h2>
      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle,#e4e4e7)]">
        <table className="w-full text-left text-[13px]">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-t border-[var(--border-subtle,#e4e4e7)] first:border-t-0">
                <th className="w-[40%] bg-[var(--bg-surface)] px-3 py-2 font-medium text-[var(--fg-muted)]">
                  {k}
                </th>
                <td className="px-3 py-2 font-mono text-[12px]">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
