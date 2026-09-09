import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

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
  listProjects: (input: { workspaceId?: string; limit?: number }) => Promise<unknown>;
  getProject: (input: { projectId?: string; publicRef?: string }) => Promise<unknown>;
  updateProject: (input: {
    projectId?: string;
    publicRef?: string;
    title?: string;
    document?: Record<string, unknown>;
    expectedRevisionNo?: number;
  }) => Promise<unknown>;
  openEditor: (input: { projectId?: string; publicRef?: string }) => Promise<unknown>;
  documentApi?: {
    getCapabilities: () => Promise<unknown>;
    validateDocument: (input: { html: string }) => Promise<unknown>;
    compileDocument: (input: { html: string }) => Promise<unknown>;
  };
};

type ToolResult = {
  content: [{ type: "text"; text: string }];
  isError?: boolean;
};

function result(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

function toolError(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : "The operation failed";
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
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
    { name: "Neonix MCP", version: "0.1.0" },
    {
      instructions:
        "Neonix compiles one self-contained neonix-document HTML file into Protocol V2 and renders motion-video projects. Validate or compile the HTML document before saving or rendering it. Legacy editor project tools may remain available for Protocol V2 documents.",
    },
  );

  const uuid = z.string().uuid();
  const documentSchema = z.record(z.string(), z.unknown());
  const projectLocator = {
    project_id: uuid.optional().describe("Project UUID."),
    public_ref: z.string().min(1).max(80).optional().describe("Stable project reference such as prj_..."),
  };

  server.registerTool(
    "list_workspaces",
    {
      title: "List workspaces",
      description: "List workspaces the authenticated user can access. Use the id when creating or listing projects.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => safely(() => api.listWorkspaces()),
  );

  server.registerTool(
    "create_project",
    {
      title: "Create project",
      description: "Create a Neonix project with an initial document revision. Call open_editor after creation to return the editor link.",
      inputSchema: {
        workspace_id: uuid.optional().describe("Workspace id; omit to use the first accessible workspace or create a personal workspace."),
        title: z.string().trim().min(1).max(200).optional(),
        document: documentSchema.optional().describe("Initial editor document as a JSON object."),
      },
      annotations: { destructiveHint: false },
    },
    (input) =>
      safely(() =>
        api.createProject({
          workspaceId: input.workspace_id,
          title: input.title,
          document: input.document,
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
      annotations: { readOnlyHint: true },
    },
    (input) => safely(() => api.listProjects({ workspaceId: input.workspace_id, limit: input.limit })),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description: "Read a project and its latest editor document revision. Provide project_id or public_ref.",
      inputSchema: projectLocator,
      annotations: { readOnlyHint: true },
    },
    (input) => safely(() => api.getProject({ projectId: input.project_id, publicRef: input.public_ref })),
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
      annotations: { destructiveHint: false },
    },
    (input) =>
      safely(() =>
        api.updateProject({
          projectId: input.project_id,
          publicRef: input.public_ref,
          title: input.title,
          document: input.document,
          expectedRevisionNo: input.expected_revision_no,
        }),
      ),
  );

  server.registerTool(
    "open_editor",
    {
      title: "Open Neonix editor",
      description: "Return the authenticated user's Neonix editor URL for a project. Provide project_id or public_ref and show the URL to the user.",
      inputSchema: projectLocator,
      annotations: { readOnlyHint: true },
    },
    (input) => safely(() => api.openEditor({ projectId: input.project_id, publicRef: input.public_ref })),
  );

  if (api.documentApi) {
    server.registerTool(
      "neonix_get_capabilities",
      {
        title: "Get Neonix capabilities",
        description: "Return supported HTML tags, CSS properties, document metadata and Protocol version.",
        inputSchema: {},
        annotations: { readOnlyHint: true },
      },
      () => safely(() => api.documentApi!.getCapabilities()),
    );

    server.registerTool(
      "neonix_validate_document",
      {
        title: "Validate Neonix HTML",
        description: "Validate a complete neonix-document HTML file and return composition and diagnostics.",
        inputSchema: { html: z.string().min(1) },
        annotations: { readOnlyHint: true },
      },
      (input) => safely(() => api.documentApi!.validateDocument({ html: input.html })),
    );

    server.registerTool(
      "neonix_compile_document",
      {
        title: "Compile Neonix HTML",
        description: "Compile a complete neonix-document HTML file into Protocol V2 JSON.",
        inputSchema: { html: z.string().min(1) },
        annotations: { readOnlyHint: true },
      },
      (input) => safely(() => api.documentApi!.compileDocument({ html: input.html })),
    );
  }

  return server;
}
