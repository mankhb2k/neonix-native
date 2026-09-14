import { Approve } from "@/components/auth/Approve";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Approve UI | Neonix",
  description: "Preview the Neonix OAuth approval interface.",
};

export default function ApproveUiPage() {
  return (
    <Approve
      authorizationId="approve-ui-preview"
      clientName="Claude"
      scopes={[
        "openid",
        "profile",
        "email",
        "offline_access",
        "projects:read",
        "projects:write",
        "projects:delete",
        "assets:read",
        "assets:write",
        "assets:delete",
        "exports:read",
        "exports:write",
        "exports:delete",
      ]}
      returnLabel="Review the permissions this MCP connection will use in your Neonix workspace."
      preview
    />
  );
}
