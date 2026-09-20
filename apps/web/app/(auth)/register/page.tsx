import { LoginForm } from "@/components/auth/LoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up | Neonix",
  description: "Create a Neonix account to start compiling HTML into motion video.",
  alternates: { canonical: "/register" },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  return (
    <LoginForm
      mode="register"
      error={params.error}
      nextPath={params.next}
    />
  );
}
