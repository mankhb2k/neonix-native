import { Suspense } from "react";
import { AuthForm } from "../_components/AuthForm";

export const metadata = {
  title: "Log in",
  description: "Log in to your Neonix workspace.",
};

export default function LoginPage() {
  return <Suspense fallback={null}><AuthForm mode="login" /></Suspense>;
}
