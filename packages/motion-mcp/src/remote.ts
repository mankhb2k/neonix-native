import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ADDITIVE_TOOL_ANNOTATIONS,
  DESTRUCTIVE_TOOL_ANNOTATIONS,
  EXTERNAL_IMPORT_TOOL_ANNOTATIONS,
  READ_ONLY_TOOL_ANNOTATIONS,
  withToolTitle,
} from "./annotations";
import { REMOTE_TOOL_OUTPUT_SCHEMAS } from "./output-schemas";
import { registerNeonixGuidance } from "./guidance";
import { MCP_SERVER_VERSION } from "./version";
import {
  MCP_APP_RESOURCE_MIME_TYPE,
  VIDEO_PREVIEW_RESOURCE_URI,
  VIDEO_PREVIEW_UI_HTML,
} from "./video-preview-ui";

/** The identity is validated by the hosting application's OAuth adapter. */
export type RemoteMcpPrincipal = {
  userId: string;
  clientId: string;
  scopes: string[];
  token: string;
  expiresAt?: number;
};

export type RemoteMcpProjectApi = {
  listWorkspaces: () => Promise<unknown>;
  createProject: (input: {
    workspaceId?: string;
    title?: string;
    document?: Record<string, unknown>;
  }) => Promise<unknown>;
  createProjectHtml: (input: {
    workspaceId?: string;
    title?: string;
    html: string;
    idempotencyKey?: string;
  }) => Promise<unknown>;
  listProjects: (input: { workspaceId?: string; limit?: number }) => Promise<unknown>;
  getProject: (input: { projectId?: string; publicRef?: string }) => Promise<unknown>;
  updateProject: (input: {
    projectId?: string;
    publicRef?: string;
    title?: string;
    document?: Record<string, unknown>;
    expectedRevisionNo?: number;
  }) => Promise<unknown>;
  deleteProject: (input: { projectId?: string; publicRef?: string }) => Promise<unknown>;
  getProjectJson: (input: { projectId?: string; publicRef?: string }) => Promise<unknown>;
  applyJsonPatch: (input: {
    projectId?: string;
    publicRef?: string;
    expectedProtocolRevisionNo: number;
    patch: Record<string, unknown>;
  }) => Promise<unknown>;
  getProjectHtml: (input: { projectId?: string; publicRef?: string }) => Promise<unknown>;
  updateProjectHtml: (input: {
    projectId?: string;
    publicRef?: string;
    html: string;
    expectedHtmlRevisionNo?: number;
    expectedProtocolRevisionNo?: number;
  }) => Promise<unknown>;
  listHtmlRevisions: (input: { projectId?: string; publicRef?: string }) => Promise<unknown>;
  getHtmlRevision: (input: { projectId?: string; publicRef?: string; revisionNo: number }) => Promise<unknown>;
  listAssets: (input: { workspaceId?: string; projectId?: string; publicRef?: string }) => Promise<unknown>;
  requestAssetUpload: (input: { workspaceId?: string; filename: string; mimeType: string; byteSize: number }) => Promise<unknown>;
  completeAssetUpload: (input: { assetId: string }) => Promise<unknown>;
  importAsset: (input: { workspaceId?: string; sourceUrl: string; filename?: string }) => Promise<unknown>;
  attachAssetToProject: (input: { projectId?: string; publicRef?: string; assetId: string }) => Promise<unknown>;
  deleteAsset: (input: { workspaceId?: string; assetId: string; replaceReferences?: boolean }) => Promise<unknown>;
  createExport: (input: { projectId?: string; publicRef?: string; protocolRevisionNo?: number; preset?: string; idempotencyKey?: string }) => Promise<unknown>;
  getExport: (input: { jobId: string }) => Promise<unknown>;
  getExportDownloadUrl: (input: { jobId: string }) => Promise<unknown>;
  cancelExport: (input: { jobId: string }) => Promise<unknown>;
  openEditor: (input: { projectId?: string; publicRef?: string }) => Promise<unknown>;
  openPreview: (input: { projectId?: string; publicRef?: string }) => Promise<unknown>;
  documentApi?: {
    getCapabilities: () => Promise<unknown>;
    validateDocument: (input: { html: string }) => Promise<unknown>;
    compileDocument: (input: { html: string }) => Promise<unknown>;
  };
};

type ToolResult = {
  content: [{ type: "text"; text: string }];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function result(value: unknown): ToolResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("MCP tool output must be a JSON object");
  }
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent: value as Record<string, unknown>,
  };
}

function toolError(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : "The operation failed";
  const details = error && typeof error === "object" && "details" in error
    ? (error as { details?: unknown }).details
    : undefined;
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "TOOL_ERROR")
    : "TOOL_ERROR";
  const retryable = code === "REVISION_CONFLICT" || code === "RATE_LIMITED" || code === "TEMPORARY_ERROR";
  const payload = {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
      retryable,
    },
  };
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(payload) }],
  };
}

async function safely<T>(operation: () => Promise<T>): Promise<ToolResult> {
  try {
    return result(await operation());
  } catch (error) {
    return toolError(error);
  }
}

/**
 * Registers Neonix's remote project tools without depending on Next.js,
 * Supabase, cookies, or a particular deployment runtime.
 */
export function createRemoteMcpServer(options: {
  api: RemoteMcpProjectApi;
  principal?: RemoteMcpPrincipal;
}) {
  const { api } = options;
  const server = new McpServer(
    { name: "Neonix MCP", version: MCP_SERVER_VERSION },
    {
      instructions:
        "Neonix is an HTML-to-motion-video compiler: it turns HTML and CSS into a real, exportable motion video. For HTML-first projects, call create_project_html with complete HTML/CSS; it compiles the source and atomically creates the project with linked HTML and Protocol V2 revisions. For existing projects, read the attached HTML with get_project_html, check its htmlSyncStatus, edit it, validate_html, then save it with update_project_html. If htmlSyncStatus is 'stale', a JSON patch or another edit already moved the project past this HTML source; saving it anyway will overwrite that change, so re-derive the HTML (or confirm with the caller) before saving. Use get_project_json only for inspection. Use apply_json_patch only for small changes that HTML cannot express; it creates a JSON revision and makes the HTML source stale. Never convert JSON back to HTML.",
    },
  );
  registerNeonixGuidance(server);

  server.registerResource(
    "Neonix video preview",
    VIDEO_PREVIEW_RESOURCE_URI,
    {
      mimeType: MCP_APP_RESOURCE_MIME_TYPE,
      description: "Inline video preview and export controls for Neonix render jobs.",
    },
    async () => ({
      contents: [{
        uri: VIDEO_PREVIEW_RESOURCE_URI,
        mimeType: MCP_APP_RESOURCE_MIME_TYPE,
        text: VIDEO_PREVIEW_UI_HTML,
        _meta: {
          ui: {
            prefersBorder: true,
            csp: {
              connectDomains: [],
              resourceDomains: [
                "https://*.r2.cloudflarestorage.com",
                "https://media.neonix.video",
              ],
            },
          },
        },
      }],
    }),
  );

  const uuid = z.string().uuid();
  const documentSchema = z.record(z.string(), z.unknown());
  const projectLocator = {
    project_id: uuid.optional().describe("Project UUID."),
    public_ref: z.string().min(1).max(80).optional().describe("Stable project reference such as prj_..."),
  };

  function requireProjectLocator(input: { project_id?: string; public_ref?: string }) {
    if ((input.project_id ? 1 : 0) + (input.public_ref ? 1 : 0) !== 1) {
      const error = new Error("Provide exactly one of project_id or public_ref");
      Object.assign(error, { code: "INVALID_INPUT" });
      throw error;
    }
  }

  server.registerTool(
    "list_workspaces",
    {
      title: "List workspaces",
      description: "List workspaces the authenticated user can access. Use the id when creating or listing projects.",
      inputSchema: {},
      annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "List workspaces"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.list_workspaces,
    },
    () => safely(async () => ({ workspaces: await api.listWorkspaces() })),
  );

  server.registerTool(
    "get_project_json",
    {
      title: "Get project JSON",
      description: "Read the canonical Protocol V2 JSON revision. This is read-only and never converts JSON back to HTML.",
      inputSchema: projectLocator,
      annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "Get project JSON"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.get_project_json,
    },
    (input) => safely(async () => {
      requireProjectLocator(input);
      return api.getProjectJson({ projectId: input.project_id, publicRef: input.public_ref });
    }),
  );

  server.registerTool(
    "apply_json_patch",
    {
      title: "Apply JSON patch",
      description: "Apply a small validated Protocol V2 patch when the requested change cannot be expressed in HTML. This creates a JSON revision and may make the HTML source stale.",
      inputSchema: {
        ...projectLocator,
        expected_protocol_revision_no: z.number().int().min(1),
        patch: z.record(z.string(), z.unknown()),
      },
      annotations: withToolTitle(ADDITIVE_TOOL_ANNOTATIONS, "Apply JSON patch"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.apply_json_patch,
    },
    (input) => safely(async () => {
      requireProjectLocator(input);
      return api.applyJsonPatch({
        projectId: input.project_id,
        publicRef: input.public_ref,
        expectedProtocolRevisionNo: input.expected_protocol_revision_no,
        patch: input.patch,
      });
    }),
  );

  server.registerTool(
    "get_project_html",
    {
      title: "Get project HTML",
      description: "Read the latest HTML authoring source attached to an existing project. Check htmlSyncStatus: 'stale' means a later JSON patch or edit changed the canonical Protocol V2 revision after this HTML was saved, so saving this HTML back would overwrite that change.",
      inputSchema: projectLocator,
      annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "Get project HTML"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.get_project_html,
    },
    (input) => safely(async () => {
      requireProjectLocator(input);
      return api.getProjectHtml({ projectId: input.project_id, publicRef: input.public_ref });
    }),
  );

  server.registerTool(
    "update_project_html",
    {
      title: "Update project HTML",
      description: "Compile and save HTML on an existing project. A successful call creates both a new HTML revision and a linked Protocol V2 JSON revision. This is a one-way flow: HTML always wins. If the project's JSON was edited independently since this HTML was last saved, that JSON is discarded and the response's `warning` field explains what was overwritten.",
      inputSchema: {
        ...projectLocator,
        html: z.string().min(1),
        expected_html_revision_no: z.number().int().min(0).optional(),
        expected_protocol_revision_no: z.number().int().min(0).optional(),
      },
      annotations: withToolTitle(ADDITIVE_TOOL_ANNOTATIONS, "Update project HTML"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.update_project_html,
    },
    (input) => safely(async () => {
      requireProjectLocator(input);
      return api.updateProjectHtml({
        projectId: input.project_id,
        publicRef: input.public_ref,
        html: input.html,
        expectedHtmlRevisionNo: input.expected_html_revision_no,
        expectedProtocolRevisionNo: input.expected_protocol_revision_no,
      });
    }),
  );

  server.registerTool(
    "list_html_revisions",
    {
      title: "List HTML revisions",
      description: "List HTML authoring revisions attached to a project.",
      inputSchema: projectLocator,
      annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "List HTML revisions"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.list_html_revisions,
    },
    (input) => safely(async () => {
      requireProjectLocator(input);
      return api.listHtmlRevisions({ projectId: input.project_id, publicRef: input.public_ref });
    }),
  );

  server.registerTool(
    "get_html_revision",
    {
      title: "Get HTML revision",
      description: "Read a specific HTML authoring revision and its linked Protocol V2 revision id.",
      inputSchema: {
        ...projectLocator,
        revision_no: z.number().int().min(1),
      },
      annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "Get HTML revision"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.get_html_revision,
    },
    (input) => safely(async () => {
      requireProjectLocator(input);
      return api.getHtmlRevision({ projectId: input.project_id, publicRef: input.public_ref, revisionNo: input.revision_no });
    }),
  );

  server.registerTool(
    "list_assets",
    {
      title: "List assets",
      description: "List ready or uploading media assets in a workspace or attached to a project.",
      inputSchema: { workspace_id: uuid.optional(), ...projectLocator },
      annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "List assets"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.list_assets,
    },
    (input) => safely(() => api.listAssets({ workspaceId: input.workspace_id, projectId: input.project_id, publicRef: input.public_ref })),
  );

  server.registerTool(
    "request_asset_upload",
    {
      title: "Request asset upload",
      description: "Create an asset record and return a short-lived R2 presigned PUT URL. The file is not attached to a project until attach_asset_to_project.",
      inputSchema: {
        workspace_id: uuid.optional(),
        filename: z.string().trim().min(1).max(200),
        mime_type: z.string().trim().min(1).max(120),
        byte_size: z.number().int().positive(),
      },
      annotations: withToolTitle(ADDITIVE_TOOL_ANNOTATIONS, "Request asset upload"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.request_asset_upload,
    },
    (input) => safely(() => api.requestAssetUpload({ workspaceId: input.workspace_id, filename: input.filename, mimeType: input.mime_type, byteSize: input.byte_size })),
  );

  server.registerTool(
    "complete_asset_upload",
    {
      title: "Complete asset upload",
      description: "Verify the uploaded R2 object size and MIME type, then mark the asset ready.",
      inputSchema: { asset_id: uuid },
      annotations: withToolTitle(ADDITIVE_TOOL_ANNOTATIONS, "Complete asset upload"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.complete_asset_upload,
    },
    (input) => safely(() => api.completeAssetUpload({ assetId: input.asset_id })),
  );

  server.registerTool(
    "import_asset",
    {
      title: "Import asset",
      description: "Download an image, video or audio file from a public URL after SSRF, MIME and size checks, then store it in the user's R2 bucket.",
      inputSchema: { workspace_id: uuid.optional(), source_url: z.string().url(), filename: z.string().trim().max(200).optional() },
      annotations: withToolTitle(EXTERNAL_IMPORT_TOOL_ANNOTATIONS, "Import asset"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.import_asset,
    },
    (input) => safely(() => api.importAsset({ workspaceId: input.workspace_id, sourceUrl: input.source_url, filename: input.filename })),
  );

  server.registerTool(
    "attach_asset_to_project",
    {
      title: "Attach asset to project",
      description: "Attach a ready workspace asset to an existing project so its asset reference can be used by Protocol V2 or HTML authoring.",
      inputSchema: { ...projectLocator, asset_id: uuid },
      annotations: withToolTitle(ADDITIVE_TOOL_ANNOTATIONS, "Attach asset to project"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.attach_asset_to_project,
    },
    (input) => safely(async () => {
      requireProjectLocator(input);
      return api.attachAssetToProject({ projectId: input.project_id, publicRef: input.public_ref, assetId: input.asset_id });
    }),
  );

  server.registerTool(
    "delete_asset",
    {
      title: "Delete asset",
      description: "Delete a workspace asset and its R2 objects. Assets referenced by projects require replace_references=true and follow the existing system fallback policy.",
      inputSchema: { workspace_id: uuid.optional(), asset_id: uuid, replace_references: z.boolean().optional() },
      annotations: withToolTitle(DESTRUCTIVE_TOOL_ANNOTATIONS, "Delete asset"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.delete_asset,
    },
    (input) => safely(() => api.deleteAsset({ workspaceId: input.workspace_id, assetId: input.asset_id, replaceReferences: input.replace_references })),
  );

  server.registerTool(
    "create_export",
    {
      title: "Create export",
      description: "Render a saved Protocol V2 project revision. The server reads the revision from the database; arbitrary unsaved JSON cannot be exported.",
      inputSchema: { ...projectLocator, protocol_revision_no: z.number().int().min(1).optional(), preset: z.string().optional(), idempotency_key: z.string().trim().min(1).max(200).optional() },
      annotations: withToolTitle(ADDITIVE_TOOL_ANNOTATIONS, "Create export"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.create_export,
      _meta: {
        ui: {
          resourceUri: VIDEO_PREVIEW_RESOURCE_URI,
        },
        "openai/outputTemplate": VIDEO_PREVIEW_RESOURCE_URI,
      },
    },
    (input) => safely(async () => {
      requireProjectLocator(input);
      return api.createExport({ projectId: input.project_id, publicRef: input.public_ref, protocolRevisionNo: input.protocol_revision_no, preset: input.preset, idempotencyKey: input.idempotency_key });
    }),
  );

  server.registerTool(
    "get_export",
    {
      title: "Get export",
      description: "Read the status of an export created by the authenticated user.",
      inputSchema: { job_id: z.string().min(1) },
      annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "Get export"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.get_export,
    },
    (input) => safely(() => api.getExport({ jobId: input.job_id })),
  );

  server.registerTool(
    "get_export_download_url",
    {
      title: "Get export download URL",
      description: "Return a short-lived signed download URL when the export is complete.",
      inputSchema: { job_id: z.string().min(1) },
      annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "Get export download URL"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.get_export_download_url,
    },
    (input) => safely(() => api.getExportDownloadUrl({ jobId: input.job_id })),
  );

  server.registerTool(
    "cancel_export",
    {
      title: "Cancel export",
      description: "Cancel a queued or rendering export owned by the authenticated user.",
      inputSchema: { job_id: z.string().min(1) },
      annotations: withToolTitle(DESTRUCTIVE_TOOL_ANNOTATIONS, "Cancel export"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.cancel_export,
    },
    (input) => safely(() => api.cancelExport({ jobId: input.job_id })),
  );

  server.registerTool(
    "create_project_html",
    {
      title: "Create HTML project",
      description: "Compile HTML and atomically create a Neonix project with linked HTML and Protocol V2 revisions.",
      inputSchema: {
        workspace_id: uuid.optional().describe("Workspace id; omit to use the first accessible workspace or create a personal workspace."),
        title: z.string().trim().min(1).max(200).optional(),
        html: z.string().min(1).describe("Complete neonix-document HTML source, including CSS in the document."),
        idempotency_key: z.string().trim().min(1).max(200).optional(),
      },
      annotations: withToolTitle(ADDITIVE_TOOL_ANNOTATIONS, "Create HTML project"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.create_project_html,
      _meta: {
        ui: { resourceUri: VIDEO_PREVIEW_RESOURCE_URI },
        "openai/outputTemplate": VIDEO_PREVIEW_RESOURCE_URI,
      },
    },
    (input) =>
      safely(() =>
        api.createProjectHtml({
          workspaceId: input.workspace_id,
          title: input.title,
          html: input.html,
          idempotencyKey: input.idempotency_key,
        }),
      ),
  );

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "List projects in an accessible workspace, newest updates first.",
      inputSchema: {
        workspace_id: uuid.optional(),
        limit: z.number().int().min(1).max(50).default(20),
      },
      annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "List projects"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.list_projects,
    },
    (input) => safely(() => api.listProjects({ workspaceId: input.workspace_id, limit: input.limit })),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description: "Read a project and its latest editor document revision. Provide project_id or public_ref.",
      inputSchema: projectLocator,
      annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "Get project"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.get_project,
    },
    (input) => safely(async () => {
      requireProjectLocator(input);
      return api.getProject({ projectId: input.project_id, publicRef: input.public_ref });
    }),
  );

  server.registerTool(
    "update_project",
    {
      title: "Update project",
      description: "Update a project title and/or append a new document revision. Use expected_revision_no to prevent overwriting a newer edit.",
      inputSchema: {
        ...projectLocator,
        title: z.string().trim().min(1).max(200).optional(),
        document: documentSchema.optional().describe("Replacement editor document as a JSON object."),
        expected_revision_no: z.number().int().min(0).optional(),
      },
      annotations: withToolTitle(ADDITIVE_TOOL_ANNOTATIONS, "Update project"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.update_project,
    },
    (input) =>
      safely(async () => {
        requireProjectLocator(input);
        return api.updateProject({
          projectId: input.project_id,
          publicRef: input.public_ref,
          title: input.title,
          document: input.document,
          expectedRevisionNo: input.expected_revision_no,
        });
      }),
  );

  server.registerTool(
    "delete_project",
    {
      title: "Delete project",
      description: "Request deletion of a project. The project enters the configured retention window.",
      inputSchema: projectLocator,
      annotations: withToolTitle(DESTRUCTIVE_TOOL_ANNOTATIONS, "Delete project"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.delete_project,
    },
    (input) => safely(async () => {
      requireProjectLocator(input);
      return api.deleteProject({ projectId: input.project_id, publicRef: input.public_ref });
    }),
  );

  server.registerTool(
    "open_editor",
    {
      title: "Open Neonix editor",
      description: "Return the authenticated user's Neonix editor URL for a project. Provide project_id or public_ref and show the URL to the user.",
      inputSchema: projectLocator,
      annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "Open Neonix editor"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.open_editor,
    },
    (input) => safely(async () => {
      requireProjectLocator(input);
      return api.openEditor({ projectId: input.project_id, publicRef: input.public_ref });
    }),
  );

  server.registerTool(
    "open_preview",
    {
      title: "Open Neonix preview",
      description: "Return the read-only Neonix preview URL for a project. Provide project_id or public_ref and show the URL to the user.",
      inputSchema: projectLocator,
      annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "Open Neonix preview"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.open_preview,
    },
    (input) => safely(async () => {
      requireProjectLocator(input);
      return api.openPreview({ projectId: input.project_id, publicRef: input.public_ref });
    }),
  );

  if (api.documentApi) {
    server.registerTool(
      "get_capabilities",
      {
        title: "Get capabilities",
        description: "Return supported HTML tags, CSS properties, document metadata, Protocol version, and allowed values for properties that reject most values (e.g. animation-timing-function only accepts linear, ease, ease-in, ease-out, ease-in-out, cubic-bezier() and steps() — not every CSS easing keyword).",
        inputSchema: {},
        annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "Get capabilities"),
        outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.get_capabilities,
      },
      () => safely(() => api.documentApi!.getCapabilities()),
    );

    server.registerTool(
      "validate_html",
      {
        title: "Validate HTML",
        description: "Validate a complete neonix-document HTML file and return composition and diagnostics.",
        inputSchema: { html: z.string().min(1) },
        annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "Validate HTML"),
        outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.validate_html,
      },
      (input) => safely(() => api.documentApi!.validateDocument({ html: input.html })),
    );

    server.registerTool(
      "compile_html",
      {
        title: "Compile HTML",
        description: "Compile a complete neonix-document HTML file into Protocol V2 JSON.",
        inputSchema: { html: z.string().min(1) },
        annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "Compile HTML"),
        outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.compile_html,
      },
      (input) => safely(() => api.documentApi!.compileDocument({ html: input.html })),
    );
  }

  return server;
}
