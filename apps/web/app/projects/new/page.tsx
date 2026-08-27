import { redirect } from "next/navigation";

/** Project creation UI will live on the control plane, not the editor host. */
export default function NewProjectPage() {
  redirect("/dashboard");
}
