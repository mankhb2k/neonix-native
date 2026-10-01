import { Suspense } from "react";
import { ConsentContent } from "./_components/ConsentContent";

export const metadata = {
  title: "Authorize access",
  description: "Allow an application to access your Neonix account.",
};

export default function McpConsentPage() {
  return (
    <Suspense fallback={null}>
      <ConsentContent />
    </Suspense>
  );
}
