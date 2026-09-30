import { Suspense } from "react";
import { ConsentContent } from "./_components/ConsentContent";

export default function McpConsentPage() {
  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <Suspense fallback={<p>{"Loading…"}</p>}>
        <ConsentContent />
      </Suspense>
    </main>
  );
}
