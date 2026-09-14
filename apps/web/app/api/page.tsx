import { ApiWorkspace } from "@/components/hub/ApiWorkspace";
import { HubFrame } from "@/components/hub/HubFrame";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API | Neonix",
  description: "Build editable motion projects with the Neonix API.",
};

export default function ApiPage() {
  return (
    <HubFrame>
      <ApiWorkspace />
    </HubFrame>
  );
}
