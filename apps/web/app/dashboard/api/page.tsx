import { HubFrame } from "../_components/HubFrame";
import { ApiWorkspace } from "./_components/ApiWorkspace";
import type { Metadata } from "next";

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
