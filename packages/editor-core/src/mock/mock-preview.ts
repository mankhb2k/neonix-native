import type {
  EditorDocument,
  EditorExportResult,
  EditorNode,
  EditorPreviewState,
} from "../model";

export function previewMockDocument(
  document: EditorDocument,
  requestedTime: number,
): EditorPreviewState {
  const time = Math.min(Math.max(0, requestedTime), document.duration);
  const activeNodeIds = new Set(
    document.clips
      .filter(
        (clip) =>
          clip.kind === "visual" &&
          clip.startTime <= time &&
          time < clip.startTime + clip.duration,
      )
      .map((clip) => clip.nodeId),
  );
  const nodes: readonly EditorNode[] = document.nodes.filter((node) =>
    activeNodeIds.has(node.id),
  );
  return {
    status: "mock",
    label: "Mock preview — no runtime evaluation",
    frame: { time, background: document.background, nodes },
  };
}

export function unavailableMockPreview(reason: string): EditorPreviewState {
  return { status: "unavailable", reason };
}

export function unavailableMockExport(reason = "Export is not available in mock mode"): EditorExportResult {
  return { status: "unavailable", reason };
}
