import type {
  EditorDocument,
  EditorExportRequest,
  EditorExportResult,
  EditorPreviewState,
} from "../model";

/** Persistence is a host concern: web supplies in-memory or localStorage. */
export interface EditorRepository {
  load(id: string): Promise<EditorDocument | null>;
  save(document: EditorDocument): Promise<void>;
}

/** Preview backends may be mock, unavailable, or eventually V2-backed. */
export interface EditorPreviewPort {
  preview(document: EditorDocument, time: number): Promise<EditorPreviewState>;
}

/** Export remains explicit until a certified V2 implementation exists. */
export interface EditorExportPort {
  export(
    document: EditorDocument,
    request: EditorExportRequest,
  ): Promise<EditorExportResult>;
}
