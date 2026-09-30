import { Suspense } from "react";
import { AuthForm } from "../_components/AuthForm";

export const metadata = {
  title: "Create your account",
  description: "Create a Neonix account.",
};

export default function RegisterPage() {
  return <Suspense fallback={null}><AuthForm mode="register" /></Suspense>;
}
