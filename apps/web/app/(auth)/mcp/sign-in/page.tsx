import { Suspense } from "react";
import { AuthForm } from "../../_components/AuthForm";

export const metadata = {
  title: "Connect to Neonix",
  description: "Sign in to connect an application to your Neonix account.",
};

export default function McpSignInPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm mode="login" oauth />
    </Suspense>
  );
}
