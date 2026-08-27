import { redirect } from "next/navigation";

/** Legacy local route retained while dashboard project creation is implemented. */
export default function LegacyNewProjectPage() {
  redirect("/dashboard");
}
