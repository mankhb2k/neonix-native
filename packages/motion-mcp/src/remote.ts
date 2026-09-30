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

/**
 * Kiến trúc A raw HTML project (see ARCHITECHTURE.md "Hai kiến trúc render
 * độc lập") blank starting point. Deliberately not imported from
 * @motionvideo/html-compiler — Kiến trúc A must not share code with Kiến
 * trúc B's compile pipeline, even a static template string. Must satisfy
 * apps/web's own copy of this template's validation rules (exactly one
 * neonix-document meta tag, no <script>, body declares matching px
 * width/height) — keep both in sync by hand if either changes.
 */
const NEONIX_RAW_HTML_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="neonix-document"
      content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1080,"height":1920,"fps":30,"background":"#000000","colorSpace":"srgb"}}'
    />
  </head>
  <body style="margin:0;width:1080px;height:1920px;background:#000000;">
    <!-- Add your HTML elements here. -->
  </body>
</html>`;

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
  createProjectHtml: (input: {
    workspaceId?: string;
    title?: string;
    html?: string;
    idempotencyKey?: string;
    ensureBrowserPreviewStyle?: boolean;
  }) => Promise<unknown>;
  listProjects: (input: {
    workspaceId?: string;
    limit?: number;
  }) => Promise<unknown>;
  getProject: (input: {
    projectId?: string;
    publicRef?: string;
  }) => Promise<unknown>;
  updateProject: (input: {
    projectId?: string;
    publicRef?: string;
    title?: string;
  }) => Promise<unknown>;
  deleteProject: (input: {
    projectId?: string;
    publicRef?: string;
  }) => Promise<unknown>;
  getProjectHtml: (input: {
    projectId?: string;
    publicRef?: string;
  }) => Promise<unknown>;
  updateProjectHtml: (input: {
    projectId?: string;
    publicRef?: string;
    html: string;
    ensureBrowserPreviewStyle?: boolean;
  }) => Promise<unknown>;
  listAssets: (input: {
    workspaceId?: string;
    projectId?: string;
    publicRef?: string;
  }) => Promise<unknown>;
  requestAssetUpload: (input: {
    workspaceId?: string;
    filename: string;
    mimeType: string;
    byteSize: number;
  }) => Promise<unknown>;
  completeAssetUpload: (input: { assetId: string }) => Promise<unknown>;
  importAsset: (input: {
    workspaceId?: string;
    sourceUrl: string;
    filename?: string;
  }) => Promise<unknown>;
  attachAssetToProject: (input: {
    projectId?: string;
    publicRef?: string;
    assetId: string;
  }) => Promise<unknown>;
  deleteAsset: (input: {
    workspaceId?: string;
    assetId: string;
    replaceReferences?: boolean;
  }) => Promise<unknown>;
  createExport: (input: {
    projectId?: string;
    publicRef?: string;
    preset?: string;
    idempotencyKey?: string;
  }) => Promise<unknown>;
  getExport: (input: { jobId: string }) => Promise<unknown>;
  getExportDownloadUrl: (input: { jobId: string }) => Promise<unknown>;
  cancelExport: (input: { jobId: string }) => Promise<unknown>;
  openPreview: (input: {
    projectId?: string;
    publicRef?: string;
  }) => Promise<unknown>;
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
  const message =
    error instanceof Error ? error.message : "The operation failed";
  const details =
    error && typeof error === "object" && "details" in error
      ? (error as { details?: unknown }).details
      : undefined;
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "TOOL_ERROR")
      : "TOOL_ERROR";
  const retryable =
    code === "REVISION_CONFLICT" ||
    code === "RATE_LIMITED" ||
    code === "TEMPORARY_ERROR";
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
 * a database, cookies, or a particular deployment runtime.
 *
 * Tools are registered in authoring-flow order (create -> browse -> preview
 * -> edit -> export -> assets -> destructive-last) purely so this file reads top-to-bottom the way an
 * agent actually uses it; MCP itself does not care about registration order.
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
        "Neonix is an HTML-to-video tool built on raw HTML projects (Kiến trúc A): a project stores HTML/CSS as-is, with no compile step, and is rendered frame by frame. create_project_html creates a project and update_project_html edits it; html is optional on create - omit it (or pass an empty string) to scaffold and save the standard blank template, then call update_project_html to author real content. Use get_project_html to read the current source. create_export renders the HTML through a headless-browser pipeline that requires composition.fps and composition.durationMs in the project's neonix-document meta tag (durationMs isn't required to create or edit the project, only to export it - add it with update_project_html first if create_export reports it missing). An export can take many minutes; create_export always returns a queued/rendering job immediately, never a finished video - poll it with get_export and only fetch the file with get_export_download_url once its status is done. Only call create_export when the user explicitly asks to render, export or download a video - never automatically after create_project_html or update_project_html. Call open_preview to show a project's current state.",
    },
  );
  registerNeonixGuidance(server);

  const uuid = z.string().uuid();
  const projectLocator = {
    project_id: uuid.optional().describe("Project UUID."),
    public_ref: z
      .string()
      .min(1)
      .max(80)
      .optional()
      .describe("Stable project reference such as prj_..."),
  };

  function requireProjectLocator(input: {
    project_id?: string;
    public_ref?: string;
  }) {
    if ((input.project_id ? 1 : 0) + (input.public_ref ? 1 : 0) !== 1) {
      const error = new Error(
        "Provide exactly one of project_id or public_ref",
      );
      Object.assign(error, { code: "INVALID_INPUT" });
      throw error;
    }
  }

  server.registerTool(
    "create_project_html",
    {
      title: "Create HTML project",
      description: `Create a Neonix project that stores HTML/CSS as-is — no compile step. This is Kiến trúc A (see ARCHITECHTURE.md "Hai kiến trúc render độc lập"): a complete project on its own, rendered frame by frame from the HTML — call create_export to render it once the user asks (that pipeline requires composition.fps and composition.durationMs in the neonix-document meta tag; add durationMs with update_project_html first if create_export reports it missing). Validation here is deliberately light: exactly one meta[name="neonix-document"] with a valid composition, no <script> tags, and <body> (or its single top-level wrapping element) must declare width/height in px matching the composition exactly. Omit html (or pass an empty string) to scaffold from the standard blank template below, already saved for real - then call update_project_html to author real content. Template:\n\n${NEONIX_RAW_HTML_TEMPLATE}`,
      inputSchema: {
        workspace_id: uuid
          .optional()
          .describe(
            "Workspace id; omit to use the first accessible workspace or create a personal workspace.",
          ),
        title: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe("Project title; a default is generated if omitted."),
        html: z
          .string()
          .optional()
          .describe(
            "Complete neonix-document HTML source, including CSS in the document. Omit (or pass an empty string) to create the project from the standard blank template instead, then finish it with update_project_html.",
          ),
        idempotency_key: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe(
            "Unique key to safely retry the same creation request without creating duplicate projects.",
          ),
      },
      annotations: withToolTitle(
        ADDITIVE_TOOL_ANNOTATIONS,
        "Create HTML project",
      ),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.create_project_html,
    },
    (input) =>
      safely(() =>
        api.createProjectHtml({
          workspaceId: input.workspace_id,
          title: input.title,
          html: input.html?.trim() ? input.html : NEONIX_RAW_HTML_TEMPLATE,
          idempotencyKey: input.idempotency_key,
        }),
      ),
  );

  server.registerTool(
    "list_workspaces",
    {
      title: "List workspaces",
      description:
        "List workspaces the authenticated user can access. Use the id when creating or listing projects.",
      inputSchema: {},
      annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "List workspaces"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.list_workspaces,
    },
    () => safely(async () => ({ workspaces: await api.listWorkspaces() })),
  );

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description:
        "List the HTML projects in an accessible workspace, newest updates first.",
      inputSchema: {
        workspace_id: uuid
          .optional()
          .describe(
            "Workspace id to list projects in; omit to use the first accessible workspace.",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe("Maximum number of projects to return."),
      },
      annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "List projects"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.list_projects,
    },
    (input) =>
      safely(() =>
        api.listProjects({
          workspaceId: input.workspace_id,
          limit: input.limit,
        }),
      ),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description:
        "Read a project's metadata (id, public_ref, workspace, title). Provide project_id or public_ref.",
      inputSchema: projectLocator,
      annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "Get project"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.get_project,
    },
    (input) =>
      safely(async () => {
        requireProjectLocator(input);
        return api.getProject({
          projectId: input.project_id,
          publicRef: input.public_ref,
        });
      }),
  );

  server.registerTool(
    "open_preview",
    {
      title: "Open Neonix preview",
      description:
        "Return the read-only Neonix preview URL for an HTML project. Provide project_id or public_ref and show the URL to the user.",
      inputSchema: projectLocator,
      annotations: withToolTitle(
        READ_ONLY_TOOL_ANNOTATIONS,
        "Open Neonix preview",
      ),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.open_preview,
    },
    (input) =>
      safely(async () => {
        requireProjectLocator(input);
        return api.openPreview({
          projectId: input.project_id,
          publicRef: input.public_ref,
        });
      }),
  );

  server.registerTool(
    "get_project_html",
    {
      title: "Get project HTML",
      description:
        "Read the current HTML source of a project.",
      inputSchema: projectLocator,
      annotations: withToolTitle(
        READ_ONLY_TOOL_ANNOTATIONS,
        "Get project HTML",
      ),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.get_project_html,
    },
    (input) =>
      safely(async () => {
        requireProjectLocator(input);
        return api.getProjectHtml({
          projectId: input.project_id,
          publicRef: input.public_ref,
        });
      }),
  );

  server.registerTool(
    "update_project_html",
    {
      title: "Update project HTML",
      description:
        "Save new HTML source on a Kiến trúc A raw HTML project — no compile step. Validation is the same light rules as create_project_html (neonix-document meta, no <script>, body/wrapper px size match).",
      inputSchema: {
        ...projectLocator,
        html: z
          .string()
          .min(1)
          .describe(
            "Complete neonix-document HTML source, including CSS in the document.",
          ),
      },
      annotations: withToolTitle(
        ADDITIVE_TOOL_ANNOTATIONS,
        "Update project HTML",
      ),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.update_project_html,
    },
    (input) =>
      safely(async () => {
        requireProjectLocator(input);
        return api.updateProjectHtml({
          projectId: input.project_id,
          publicRef: input.public_ref,
          html: input.html,
        });
      }),
  );

  server.registerTool(
    "update_project",
    {
      title: "Update project",
      description:
        "Rename a project.",
      inputSchema: {
        ...projectLocator,
        title: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe("New project title."),
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
        });
      }),
  );

  server.registerTool(
    "create_export",
    {
      title: "Create export",
      description:
        "Render a Kiến trúc A raw HTML project and return a job to poll with get_export. The HTML is rendered directly via a headless-browser pipeline that requires composition.fps and composition.durationMs in the project's own neonix-document meta tag (durationMs isn't required to create/edit the project, only to export it); add durationMs with update_project_html first if it's missing, then retry. A job can take many minutes - this call returns immediately with a queued/rendering job, never a finished video; only call this when the user explicitly asks to render, export or download a video, never automatically after create_project_html or update_project_html.",
      inputSchema: {
        ...projectLocator,
        preset: z
          .string()
          .optional()
          .describe("Named export preset; omit to use the project's default."),
        idempotency_key: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe(
            "Unique key to safely retry the same export request without creating duplicates.",
          ),
      },
      annotations: withToolTitle(ADDITIVE_TOOL_ANNOTATIONS, "Create export"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.create_export,
    },
    (input) =>
      safely(async () => {
        requireProjectLocator(input);
        return api.createExport({
          projectId: input.project_id,
          publicRef: input.public_ref,
          preset: input.preset,
          idempotencyKey: input.idempotency_key,
        });
      }),
  );

  server.registerTool(
    "get_export",
    {
      title: "Get export",
      description:
        "Read the status of an export created by the authenticated user.",
      inputSchema: {
        job_id: z
          .string()
          .min(1)
          .describe("Export job id returned by create_export."),
      },
      annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "Get export"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.get_export,
    },
    (input) => safely(() => api.getExport({ jobId: input.job_id })),
  );

  server.registerTool(
    "get_export_download_url",
    {
      title: "Get export download URL",
      description:
        "Return a short-lived signed download URL when the export is complete.",
      inputSchema: {
        job_id: z
          .string()
          .min(1)
          .describe("Export job id to get a signed download URL for."),
      },
      annotations: withToolTitle(
        READ_ONLY_TOOL_ANNOTATIONS,
        "Get export download URL",
      ),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.get_export_download_url,
    },
    (input) => safely(() => api.getExportDownloadUrl({ jobId: input.job_id })),
  );

  server.registerTool(
    "cancel_export",
    {
      title: "Cancel export",
      description:
        "Cancel a queued or rendering export owned by the authenticated user.",
      inputSchema: {
        job_id: z.string().min(1).describe("Export job id to cancel."),
      },
      annotations: withToolTitle(DESTRUCTIVE_TOOL_ANNOTATIONS, "Cancel export"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.cancel_export,
    },
    (input) => safely(() => api.cancelExport({ jobId: input.job_id })),
  );

  server.registerTool(
    "list_assets",
    {
      title: "List assets",
      description:
        "List ready or uploading media assets in a workspace or attached to a project.",
      inputSchema: {
        workspace_id: uuid
          .optional()
          .describe(
            "Workspace id to list assets in; omit when filtering by project instead.",
          ),
        ...projectLocator,
      },
      annotations: withToolTitle(READ_ONLY_TOOL_ANNOTATIONS, "List assets"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.list_assets,
    },
    (input) =>
      safely(() =>
        api.listAssets({
          workspaceId: input.workspace_id,
          projectId: input.project_id,
          publicRef: input.public_ref,
        }),
      ),
  );

  server.registerTool(
    "request_asset_upload",
    {
      title: "Request asset upload",
      description:
        "Create an asset record and return a short-lived R2 presigned PUT URL. The file is not attached to a project until attach_asset_to_project.",
      inputSchema: {
        workspace_id: uuid
          .optional()
          .describe(
            "Workspace id the asset belongs to; omit to use the first accessible workspace.",
          ),
        filename: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe(
            "Original filename, used to infer format and shown in asset listings.",
          ),
        mime_type: z
          .string()
          .trim()
          .min(1)
          .max(120)
          .describe("MIME type of the file being uploaded."),
        byte_size: z
          .number()
          .int()
          .positive()
          .describe(
            "File size in bytes; must match the uploaded object or completion fails.",
          ),
      },
      annotations: withToolTitle(
        ADDITIVE_TOOL_ANNOTATIONS,
        "Request asset upload",
      ),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.request_asset_upload,
    },
    (input) =>
      safely(() =>
        api.requestAssetUpload({
          workspaceId: input.workspace_id,
          filename: input.filename,
          mimeType: input.mime_type,
          byteSize: input.byte_size,
        }),
      ),
  );

  server.registerTool(
    "complete_asset_upload",
    {
      title: "Complete asset upload",
      description:
        "Verify the uploaded R2 object size and MIME type, then mark the asset ready.",
      inputSchema: {
        asset_id: uuid.describe("Asset id returned by request_asset_upload."),
      },
      annotations: withToolTitle(
        ADDITIVE_TOOL_ANNOTATIONS,
        "Complete asset upload",
      ),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.complete_asset_upload,
    },
    (input) =>
      safely(() => api.completeAssetUpload({ assetId: input.asset_id })),
  );

  server.registerTool(
    "import_asset",
    {
      title: "Import asset",
      description:
        "Download an image, video or audio file from a public URL after SSRF, MIME and size checks, then store it in the user's R2 bucket.",
      inputSchema: {
        workspace_id: uuid
          .optional()
          .describe(
            "Workspace id the imported asset belongs to; omit to use the first accessible workspace.",
          ),
        source_url: z
          .string()
          .url()
          .describe("Public HTTP(S) URL to download the asset from."),
        filename: z
          .string()
          .trim()
          .max(200)
          .optional()
          .describe(
            "Filename to store the asset as; inferred from the URL if omitted.",
          ),
      },
      annotations: withToolTitle(
        EXTERNAL_IMPORT_TOOL_ANNOTATIONS,
        "Import asset",
      ),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.import_asset,
    },
    (input) =>
      safely(() =>
        api.importAsset({
          workspaceId: input.workspace_id,
          sourceUrl: input.source_url,
          filename: input.filename,
        }),
      ),
  );

  server.registerTool(
    "attach_asset_to_project",
    {
      title: "Attach asset to project",
      description:
        "Attach a ready workspace asset to an existing project so its asset reference can be used in HTML authoring.",
      inputSchema: {
        ...projectLocator,
        asset_id: uuid.describe("Ready workspace asset id to attach."),
      },
      annotations: withToolTitle(
        ADDITIVE_TOOL_ANNOTATIONS,
        "Attach asset to project",
      ),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.attach_asset_to_project,
    },
    (input) =>
      safely(async () => {
        requireProjectLocator(input);
        return api.attachAssetToProject({
          projectId: input.project_id,
          publicRef: input.public_ref,
          assetId: input.asset_id,
        });
      }),
  );

  server.registerTool(
    "delete_asset",
    {
      title: "Delete asset",
      description:
        "Delete a workspace asset and its R2 objects. Assets referenced by projects require replace_references=true and follow the existing system fallback policy.",
      inputSchema: {
        workspace_id: uuid
          .optional()
          .describe("Workspace id the asset belongs to."),
        asset_id: uuid.describe("Asset id to delete."),
        replace_references: z
          .boolean()
          .optional()
          .describe(
            "If true, allow deleting an asset still referenced by projects by falling back to the system default.",
          ),
      },
      annotations: withToolTitle(DESTRUCTIVE_TOOL_ANNOTATIONS, "Delete asset"),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.delete_asset,
    },
    (input) =>
      safely(() =>
        api.deleteAsset({
          workspaceId: input.workspace_id,
          assetId: input.asset_id,
          replaceReferences: input.replace_references,
        }),
      ),
  );

  server.registerTool(
    "delete_project",
    {
      title: "Delete project",
      description:
        "Request deletion of a project. The project enters the configured retention window.",
      inputSchema: projectLocator,
      annotations: withToolTitle(
        DESTRUCTIVE_TOOL_ANNOTATIONS,
        "Delete project",
      ),
      outputSchema: REMOTE_TOOL_OUTPUT_SCHEMAS.delete_project,
    },
    (input) =>
      safely(async () => {
        requireProjectLocator(input);
        return api.deleteProject({
          projectId: input.project_id,
          publicRef: input.public_ref,
        });
      }),
  );

  return server;
}
