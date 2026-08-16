import { JsonBlock } from "@/components/docs/JsonBlock";
import { attemptParse } from "@/lib/docs/parse-result";

export function ValidInvalid({
  valid,
  invalid,
}: {
  valid: unknown;
  invalid: unknown;
}) {
  const good = attemptParse(valid);
  const bad = attemptParse(invalid);
  return (
    <section id="valid-invalid" className="my-8 grid gap-4 md:grid-cols-2">
      <div>
        <h2 className="mb-2 text-xl font-semibold tracking-tight">Valid</h2>
        <p
          className={`mb-2 text-[12px] ${good.ok ? "text-emerald-700" : "text-red-700"}`}
        >
          {good.message}
        </p>
        <JsonBlock maxLines={12} code={JSON.stringify(valid, null, 2)} />
      </div>
      <div>
        <h2 className="mb-2 text-xl font-semibold tracking-tight">Invalid</h2>
        <p
          className={`mb-2 text-[12px] ${bad.ok ? "text-emerald-700" : "text-red-700"}`}
        >
          {bad.message}
        </p>
        <JsonBlock maxLines={12} code={JSON.stringify(invalid, null, 2)} />
      </div>
    </section>
  );
}
