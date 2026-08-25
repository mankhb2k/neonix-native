import { LoginForm } from "@/app/login/login-form";

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
