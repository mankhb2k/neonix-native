import { notFound } from "next/navigation";
import { EditorShell } from "@/components/editor/EditorShell";
import {
  createV2EditorProject,
  isV2EditorProjectId,
} from "@/lib/editor/document/demo-projects";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!isV2EditorProjectId(projectId)) notFound();
  return <EditorShell initialDocument={createV2EditorProject(projectId)} />;
}
