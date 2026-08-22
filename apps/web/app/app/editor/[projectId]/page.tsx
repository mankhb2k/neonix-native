import { notFound } from "next/navigation";
import { V2Editor } from "@/components/editor-v2/V2Editor";
import {
  createV2EditorProject,
  isV2EditorProjectId,
} from "@/lib/v2-editor/projects";

export default async function V2EditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!isV2EditorProjectId(projectId)) notFound();
  return <V2Editor project={createV2EditorProject(projectId)} />;
}
