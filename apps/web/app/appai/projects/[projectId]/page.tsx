import { ReviewWorkspace } from "@/components/appai/review-workspace";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ReviewWorkspace projectId={projectId} />;
}
