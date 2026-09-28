import { notFound, redirect } from "next/navigation";
import { HtmlPreviewShell } from "@/components/preview/HtmlPreviewShell";
import {
  getProjectHtml,
  ProjectRepositoryError,
} from "@/lib/server/projects/repository";
import { authenticatedProjectContext } from "@/lib/server/projects/web-context";

export default async function HtmlPreviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  try {
    const { client, actor } = await authenticatedProjectContext();
    const { project, html } = await getProjectHtml(client, actor, { projectId });

    // Already converted (Kiến trúc B -> Kiến trúc A) — the Neonix JSON V2
    // preview route owns this project now.
    if (project.currentRevisionNo > 0) {
      redirect(`/preview/${project.id}`);
    }

    return (
      <HtmlPreviewShell projectId={project.id} title={project.title} html={html ?? ""} />
    );
  } catch (error) {
    if (error instanceof ProjectRepositoryError) {
      if (error.code === "UNAUTHENTICATED") {
        redirect(`/login?next=${encodeURIComponent(`/preview/html/${projectId}`)}`);
      }
      if (error.code === "NOT_FOUND") notFound();
    }
    throw error;
  }
}
