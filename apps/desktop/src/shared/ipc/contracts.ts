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
};

export type ProjectOpenResult = {
  path: string;
  projectId: string;
  documentJson: string;
};

/** In-memory new project — not written until save/saveAs. */
export type ProjectNewResult = {
  projectId: string;
  documentJson: string;
  name: string;
};

export type SaveProjectInput = {
  path?: string;
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

export type ImportFilesInput = {
  /** Absolute path to the saved .mt project file (required). */
  projectPath: string;
  paths?: string[];
};

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
  projectPath: string;
  assetId: string;
  uri: string;
};

export type ResolvedAsset = {
  assetId: string;
  url: string;
};

export type RelinkAssetInput = {
  projectPath: string;
  assetId: string;
  /** Absolute path to replacement file; omit to open a picker in main. */
  newPath?: string;
};

export type RelinkAssetResult = {
  assetId: string;
  uri: string;
  assetType: AssetType;
  mimeType?: string;
  absolutePath?: string;
};

export type AssetManifestEntry = {
  id: string;
  uri: string;
};

export type ListMissingAssetsInput = {
  projectPath: string;
  assets: AssetManifestEntry[];
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
  /** Saved .mt path — dirname used as assetBaseDir when present. */
  projectPath?: string;
  /** Destination MP4; omit to open a Save dialog in main. */
  outputPath?: string;
  /** When false (default), refuse to overwrite an existing outputPath. */
  overwrite?: boolean;
  presetId?: string;
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
    create(): Promise<ProjectNewResult>;
    open(): Promise<ProjectOpenResult | null>;
    openPath(path: string): Promise<ProjectOpenResult>;
    save(input: SaveProjectInput): Promise<SaveProjectResult>;
    saveAs(input: SaveProjectAsInput): Promise<SaveProjectResult>;
    getRecent(): Promise<RecentProject[]>;
  };
  assets: {
    importFiles(input: ImportFilesInput): Promise<ImportedAsset[]>;
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
