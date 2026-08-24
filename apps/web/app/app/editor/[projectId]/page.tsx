import { notFound } from "next/navigation";
import { EditorShell } from "@/components/editor/EditorShell";
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
  return <EditorShell v2Document={createV2EditorProject(projectId)} />;
}
