import { redirect } from "next/navigation";

/** Legacy local route; the dashboard now lives at neonix.video/dashboard. */
export default function LegacyAppHomePage() {
  redirect("/dashboard");
}
