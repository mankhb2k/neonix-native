import { notFound, redirect } from "next/navigation";
import { PreviewShell } from "@/components/preview/PreviewShell";
import {
  createV2EditorProject,
  isV2EditorProjectId,
} from "@/lib/editor/document/demo-projects";
import {
  loadProject,
  ProjectRepositoryError,
} from "@/lib/editor/document/project-repository";
import { appUrl } from "@/lib/hosts";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (isV2EditorProjectId(projectId)) {
    return (
      <PreviewShell
        project={createV2EditorProject(projectId)}
        projectId={projectId}
        title={`Demo preview · ${projectId}`}
        editorHref={`/app/editor/${projectId}`}
      />
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/preview/${projectId}`)}`);
  }

  try {
    const snapshot = await loadProject(projectId);
    return (
      <PreviewShell
        project={snapshot.document}
        projectId={snapshot.projectId}
        title={snapshot.title}
        revisionNo={snapshot.revisionNo}
        editorHref={appUrl(`/editor/${snapshot.projectId}`)}
      />
    );
  } catch (error) {
    if (error instanceof ProjectRepositoryError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
}
