import { notFound } from "next/navigation";
import { SwaggerApiReference } from "@/components/docs/SwaggerApiReference";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API preview",
  description: "Interactive OpenAPI reference for the Neonix API v1.",
  robots: { index: false, follow: false },
};

export default function ApiPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SwaggerApiReference />;
}
