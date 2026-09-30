import { Suspense } from "react";
import { SignInContent } from "./_components/SignInContent";

export default function McpSignInPage() {
  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <Suspense fallback={<p>{"Loading…"}</p>}>
        <SignInContent />
      </Suspense>
    </main>
  );
}
