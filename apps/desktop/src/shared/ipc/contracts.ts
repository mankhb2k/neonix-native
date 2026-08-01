export type RendererMode = "legacy" | "vite";

export type DesktopInfo = {
  platform: string;
  version: string;
  packaged: boolean;
  renderer: RendererMode;
};

export type ConfirmCloseInput = {
  ok: boolean;
};

export type RecentProject = {
  id: string;
  name: string;
  path: string;
  openedAt: string;
  aspectRatio?: string;
};

export type ProjectOpenResult = {
  path: string;
  projectId: string;
  documentJson: string;
  /** True when documentJson came from crash-recovery journal snapshot. */
  recoveredFromJournal?: boolean;
};

export type JournalStatusResult = {
  enabled: boolean;
  dirty: boolean;
  projectId?: string;
  path?: string;
  lastSeq: number;
  hasRecoverableSnapshot: boolean;
  snapshotAt?: string;
  diskDocumentHash?: string;
  journalDocumentHash?: string;
};

export type JournalRecordInput = {
  projectId: string;
  entryId: string;
  label: string;
  /** SHA-256 hex of document JSON — no full document over IPC. */
  documentJsonHash: string;
};

export type JournalAutosaveInput = {
  projectId: string;
  documentJson: string;
};

export type JournalLocatorInput = {
  projectId?: string;
};

export type JournalRecoverResult = {
  documentJson: string;
  projectId?: string;
};

export type JournalRecordResult = {
  recorded: boolean;
  seq?: number;
};

export type JournalAutosaveResult = {
  saved: boolean;
  seq?: number;
};

/** In-memory new project — not written until save/saveAs. */
export type ProjectNewResult = {
  projectId: string;
  documentJson: string;
  name: string;
  aspectRatio?: string;
};

export type CreateProjectInput = {
  name?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
};

export type SaveProjectInput = {
  documentJson: string;
};

export type SaveProjectAsInput = {
  suggestedName?: string;
  documentJson: string;
};

export type SaveProjectResult = {
  path: string;
};

export type AssetType = "image" | "svg" | "video" | "audio" | "font" | "unknown";

/** Import uses main dialog; project path comes from main session. */
export type ImportFilesInput = void | Record<string, never> | null | undefined;

export type ImportedAsset = {
  id: string;
  uri: string;
  assetType: AssetType;
  mimeType?: string;
  /** Absolute path of the copied file on disk (main only / diagnostics). */
  absolutePath?: string;
  width?: number;
  height?: number;
  duration?: number;
};

export type ResolveAssetInput = {
  assetId: string;
  uri: string;
};

export type ResolvedAsset = {
  assetId: string;
  url: string;
};

export type RelinkAssetInput = {
  assetId: string;
};

export type RelinkAssetResult = {
  assetId: string;
  uri: string;
  assetType: AssetType;
  mimeType?: string;
  absolutePath?: string;
  width?: number;
  height?: number;
  duration?: number;
};

export type AssetManifestEntry = {
  id: string;
  uri: string;
};

export type ListMissingAssetsInput = {
  assets: AssetManifestEntry[];
};

/** Main-service form — project path resolved from session, not IPC. */
export type ListMissingAssetsRequest = ListMissingAssetsInput & {
  projectPath: string;
};

export type MissingAsset = {
  id: string;
  uri: string;
};

export type ListMissingAssetsResult = {
  missing: MissingAsset[];
};

export type StartExportInput = {
  projectId: string;
  /** Baked MotionProject JSON (not desktop envelope). */
  projectJson: string;
  /** When false (default), refuse to overwrite an existing dialog-chosen path. */
  overwrite?: boolean;
  presetId?: string;
};

/** Main-service form — session path + optional dialog-bypass for tests. */
export type StartExportRequest = StartExportInput & {
  projectPath?: string;
  outputPath?: string;
};

export type ExportJob = {
  id: string;
};

export type CancelExportInput = {
  jobId: string;
};

export type ExportEvent =
  | {
      type: "progress";
      jobId: string;
      ratio: number;
      sequence: number;
      message?: string;
    }
  | {
      type: "completed";
      jobId: string;
      outputPath: string;
      sequence: number;
    }
  | {
      type: "failed";
      jobId: string;
      message: string;
      sequence: number;
    }
  | { type: "cancelled"; jobId: string; sequence: number };

/** Nested typed desktop API (Phase 2+). */
export type DesktopAPI = {
  app: {
    getInfo(): Promise<DesktopInfo>;
  };
  window: {
    minimize(): Promise<void>;
    toggleMaximize(): Promise<boolean>;
    close(): Promise<void>;
    isMaximized(): Promise<boolean>;
    onRequestCloseSave(cb: () => void): () => void;
    confirmClose(ok: boolean): Promise<void>;
  };
  project: {
    create(input?: CreateProjectInput): Promise<ProjectNewResult>;
    open(): Promise<ProjectOpenResult | null>;
    openRecent(id: string): Promise<ProjectOpenResult>;
    save(input: SaveProjectInput): Promise<SaveProjectResult>;
    saveAs(input: SaveProjectAsInput): Promise<SaveProjectResult>;
    getRecent(): Promise<RecentProject[]>;
  };
  journal: {
    status(input?: JournalLocatorInput): Promise<JournalStatusResult>;
    record(input: JournalRecordInput): Promise<JournalRecordResult>;
    autosave(input: JournalAutosaveInput): Promise<JournalAutosaveResult>;
    recover(input?: JournalLocatorInput): Promise<JournalRecoverResult | null>;
    discard(input?: JournalLocatorInput): Promise<void>;
  };
  assets: {
    importFiles(input?: ImportFilesInput): Promise<ImportedAsset[]>;
    resolveUrl(input: ResolveAssetInput): Promise<ResolvedAsset>;
    relink(input: RelinkAssetInput): Promise<RelinkAssetResult>;
    listMissing(input: ListMissingAssetsInput): Promise<ListMissingAssetsResult>;
  };
  export: {
    start(input: StartExportInput): Promise<ExportJob>;
    cancel(input: CancelExportInput): Promise<void>;
    subscribe(listener: (event: ExportEvent) => void): () => void;
  };
};

/** Flat legacy surface kept for apps/web consumers. */
export type MotionVideoDesktopFlat = {
  isDesktop: true;
  getInfo: () => Promise<DesktopInfo>;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<boolean>;
  windowClose: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;
  onRequestCloseSave: (cb: () => void) => () => void;
  confirmClose: (ok: boolean) => Promise<void>;
};

/** Bridge object exposed on window — nested API + flat shims. */
export type MotionVideoDesktopBridge = DesktopAPI & MotionVideoDesktopFlat;
