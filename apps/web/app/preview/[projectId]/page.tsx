import { notFound } from "next/navigation";
import { PreviewShell } from "@/components/preview/PreviewShell";
import {
  createV2EditorProject,
  isV2EditorProjectId,
} from "@/lib/editor/document/demo-projects";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!isV2EditorProjectId(projectId)) notFound();
  return (
    <PreviewShell
      project={createV2EditorProject(projectId)}
      projectId={projectId}
      title={`Demo preview · ${projectId}`}
      editorHref={`/app/editor/${projectId}`}
    />
  );
}
