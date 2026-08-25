import { notFound, redirect } from "next/navigation";
import { EditorShell } from "@/components/editor/EditorShell";
import {
  createV2EditorProject,
  isV2EditorProjectId,
} from "@/lib/editor/document/demo-projects";
import {
  loadProject,
  ProjectRepositoryError,
} from "@/lib/editor/document/project-repository";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (isV2EditorProjectId(projectId)) {
    return <EditorShell initialDocument={createV2EditorProject(projectId)} />;
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/app/editor/${projectId}`)}`);
  }

  try {
    const snapshot = await loadProject(projectId);
    return (
      <EditorShell
        initialDocument={snapshot.document}
        projectRef={snapshot.projectId}
        initialRevisionNo={snapshot.revisionNo}
      />
    );
  } catch (error) {
    if (
      error instanceof ProjectRepositoryError &&
      error.code === "NOT_FOUND"
    ) {
      notFound();
    }
    throw error;
  }
}
