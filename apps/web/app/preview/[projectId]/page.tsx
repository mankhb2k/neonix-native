import { ProjectPreview } from "./_components/ProjectPreview";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Project preview",
  robots: { index: false, follow: false },
};

export default async function PreviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectPreview projectId={projectId} />;
}
