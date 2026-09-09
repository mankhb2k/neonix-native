import type { Metadata } from "next";
import { SwaggerApiReference } from "@/components/docs/SwaggerApiReference";

export const metadata: Metadata = {
  title: "API preview",
  description: "Interactive OpenAPI reference for the Neonix API v1.",
  robots: { index: false, follow: false },
};

export default function ApiPreviewPage() {
  return <SwaggerApiReference />;
}
