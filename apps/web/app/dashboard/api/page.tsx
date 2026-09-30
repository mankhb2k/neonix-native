import type { Metadata } from "next";
import { HubFrame } from "@/components/hub/HubFrame";
import { ApiWorkspace } from "@/components/hub/ApiWorkspace";

export const metadata: Metadata = {
  title: "API keys",
  description: "Create and manage Neonix API keys.",
};

export default function DashboardApiPage() {
  return (
    <HubFrame>
      <ApiWorkspace />
    </HubFrame>
  );
}
