import { LoginForm } from "@/components/auth/LoginForm";

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
