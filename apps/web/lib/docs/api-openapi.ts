export const NEONIX_OPENAPI = {
  openapi: "3.1.0",
  info: {
    title: "Neonix API",
    version: "1.0.0",
    description:
      "HTML-first API for validating and compiling Neonix documents into Neonix JSON V2, persisting projects, and creating render jobs.",
  },
  servers: [{ url: "/", description: "Current Neonix app" }],
  tags: [
    { name: "Documents", description: "Stateless HTML validation and compilation" },
    { name: "Projects", description: "Persisted HTML projects and immutable revisions" },
    { name: "Renders", description: "Video render requests and output" },
    { name: "Jobs", description: "Asynchronous render job lifecycle" },
    { name: "Assets", description: "User media assets" },
    { name: "Fonts", description: "User font assets" },
    { name: "Capabilities", description: "Compiler support contract" },
    { name: "System", description: "System assets, fonts, and preview resources" },
    { name: "Authentication", description: "Supabase browser authentication callbacks" },
    { name: "OAuth", description: "OAuth consent and authorization decisions" },
    { name: "MCP", description: "Hosted Model Context Protocol transport" },
    { name: "Internal", description: "Private worker callbacks; not for browser clients" },
    { name: "Development", description: "Local development-only helpers" },
  ],
  paths: {
    "/api/v1/capabilities": {
      get: {
        tags: ["Capabilities"],
        summary: "Get compiler capabilities",
        responses: { "200": { description: "Supported HTML tags and CSS properties" } },
      },
    },
    "/api/v1/documents/validate": {
      post: {
        tags: ["Documents"],
        summary: "Validate a Neonix HTML document",
        description: "Accepts one final HTML document containing its style blocks and neonix-document meta manifest.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/HtmlDocumentRequest" } } } },
        responses: {
          "200": { description: "Validation result", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationResponse" } } } },
          "400": { $ref: "#/components/responses/InvalidInput" },
          "422": { $ref: "#/components/responses/CompilerError" },
        },
      },
    },
    "/api/v1/documents/compile": {
      post: {
        tags: ["Documents"],
        summary: "Compile HTML into Neonix JSON V2",
        description: "The primary AI/user endpoint: final.html-like source goes in, normalized Neonix JSON V2 comes out.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/HtmlDocumentRequest" } } } },
        responses: {
          "200": { description: "Compiled Neonix JSON V2 document", content: { "application/json": { schema: { $ref: "#/components/schemas/CompileResponse" } } } },
          "400": { $ref: "#/components/responses/InvalidInput" },
          "422": { $ref: "#/components/responses/CompilerError" },
        },
      },
    },
    "/api/v1/projects": {
      get: {
        tags: ["Projects"],
        summary: "List Neonix JSON V2 projects",
        parameters: [{ $ref: "#/components/parameters/Limit" }],
        responses: { "200": { description: "Project list" }, "401": { $ref: "#/components/responses/Unauthorized" } },
      },
      post: {
        tags: ["Projects"],
        summary: "Create a Neonix JSON V2 project",
        description: "Creates the project and its initial canonical Neonix JSON V2 revision. HTML is attached later as an authoring subresource.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateProjectRequest" } } } },
        responses: { "201": { description: "Created project" }, "401": { $ref: "#/components/responses/Unauthorized" }, "422": { $ref: "#/components/responses/CompilerError" } },
      },
    },
    "/api/v1/projects/html": {
      post: {
        tags: ["Projects"],
        summary: "Create an HTML-authored project",
        description: "Compiles HTML and atomically creates the project, canonical Neonix JSON V2 revision, and linked HTML authoring revision.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateHtmlProjectRequest" } } } },
        responses: { "201": { description: "Created HTML project" }, "401": { $ref: "#/components/responses/Unauthorized" }, "422": { $ref: "#/components/responses/CompilerError" } },
      },
    },
    "/api/v1/projects/{projectId}": {
      get: {
        tags: ["Projects"],
        summary: "Get a project",
        parameters: [{ $ref: "#/components/parameters/ProjectId" }],
        responses: { "200": { description: "Project and latest revision" }, "404": { $ref: "#/components/responses/NotFound" } },
      },
      patch: {
        tags: ["Projects"],
        summary: "Update a Neonix JSON V2 project",
        parameters: [{ $ref: "#/components/parameters/ProjectId" }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateProjectRequest" } } } },
        responses: { "200": { description: "Updated project" }, "409": { description: "Revision conflict" }, "422": { $ref: "#/components/responses/CompilerError" } },
      },
      delete: {
        tags: ["Projects"],
        summary: "Soft-delete a project",
        description: "Marks the project for retention-window purge. Immutable JSON and HTML revisions remain protected by the database lifecycle.",
        parameters: [{ $ref: "#/components/parameters/ProjectId" }],
        responses: { "200": { description: "Project marked deleted" }, "401": { $ref: "#/components/responses/Unauthorized" }, "404": { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/projects/{projectId}/html": {
      get: {
        tags: ["Projects"],
        summary: "Get the latest HTML authoring source",
        parameters: [{ $ref: "#/components/parameters/ProjectId" }],
        responses: { "200": { description: "HTML source and linked revision" }, "404": { $ref: "#/components/responses/NotFound" } },
      },
      put: {
        tags: ["Projects"],
        summary: "Compile and save HTML authoring source",
        description: "Atomically creates a Neonix JSON V2 revision and its linked HTML revision.",
        parameters: [{ $ref: "#/components/parameters/ProjectId" }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateHtmlProjectRequest" } } } },
        responses: { "200": { description: "Updated project and linked revisions" }, "409": { description: "Revision conflict" }, "422": { $ref: "#/components/responses/CompilerError" } },
      },
    },
    "/api/v1/projects/{projectId}/json": {
      patch: {
        tags: ["Projects"],
        summary: "Apply a validated Neonix JSON V2 patch",
        description: "Creates a JSON revision. This is an explicit escape hatch for changes that HTML cannot express.",
        parameters: [{ $ref: "#/components/parameters/ProjectId" }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/JsonPatchRequest" } } } },
        responses: { "200": { description: "Patched project" }, "409": { description: "Revision conflict" }, "422": { $ref: "#/components/responses/CompilerError" } },
      },
    },
    "/api/v1/projects/{projectId}/document": {
      get: {
        tags: ["Projects"],
        summary: "Get the latest authored HTML",
        parameters: [{ $ref: "#/components/parameters/ProjectId" }],
        responses: { "200": { description: "HTML source document" } },
      },
    },
    "/api/v1/projects/{projectId}/revisions": {
      get: {
        tags: ["Projects"],
        summary: "List project revisions",
        parameters: [{ $ref: "#/components/parameters/ProjectId" }],
        responses: { "200": { description: "Revision list" } },
      },
    },
    "/api/v1/projects/{projectId}/revisions/{revisionNo}": {
      get: {
        tags: ["Projects"],
        summary: "Get one project revision",
        parameters: [{ $ref: "#/components/parameters/ProjectId" }, { $ref: "#/components/parameters/RevisionNo" }],
        responses: { "200": { description: "Revision" }, "404": { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/projects/{projectId}/revisions/{revisionNo}/json": {
      get: {
        tags: ["Projects"],
        summary: "Get the canonical Neonix JSON V2 revision",
        description: "Returns the immutable JSON source of truth generated from the HTML revision with the same revision number.",
        parameters: [{ $ref: "#/components/parameters/ProjectId" }, { $ref: "#/components/parameters/RevisionNo" }],
        responses: { "200": { description: "Canonical Neonix JSON V2 revision" }, "404": { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/projects/{projectId}/assets": {
      post: {
        tags: ["Assets"],
        summary: "Attach an asset to a project",
        parameters: [{ $ref: "#/components/parameters/ProjectId" }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AttachAssetRequest" } } } },
        responses: { "200": { description: "Attached asset" } },
      },
    },
    "/api/v1/projects/{projectId}/renders": {
      post: {
        tags: ["Renders"],
        summary: "Create a render job for a project",
        parameters: [{ $ref: "#/components/parameters/ProjectId" }],
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/RenderRequest" } } } },
        responses: { "202": { description: "Render job accepted" } },
      },
    },
    "/api/v1/editor/projects/{projectId}": {
      get: {
        tags: ["Projects"],
        summary: "Read an editor Neonix JSON V2 project",
        description: "Legacy editor persistence remains versioned under this explicit editor namespace.",
        parameters: [{ $ref: "#/components/parameters/ProjectId" }],
        responses: { "200": { description: "Neonix JSON V2 editor project" } },
      },
      patch: {
        tags: ["Projects"],
        summary: "Update an editor Neonix JSON V2 project",
        parameters: [{ $ref: "#/components/parameters/ProjectId" }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: true } } } },
        responses: { "200": { description: "Updated editor project" } },
      },
    },
    "/api/v1/renders": {
      get: { tags: ["Renders"], summary: "List render jobs", responses: { "200": { description: "Render jobs" } } },
      post: {
        tags: ["Renders"],
        summary: "Create a render job from Neonix JSON V2",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RenderRequest" } } } },
        responses: { "202": { description: "Render job accepted" } },
      },
    },
    "/api/v1/renders/{id}": {
      get: { tags: ["Renders"], summary: "Get render status", parameters: [{ $ref: "#/components/parameters/RenderId" }], responses: { "200": { description: "Render job" } } },
      delete: { tags: ["Renders"], summary: "Cancel a render", parameters: [{ $ref: "#/components/parameters/RenderId" }], responses: { "200": { description: "Cancelled render" } } },
    },
    "/api/v1/renders/{id}/download": {
      get: { tags: ["Renders"], summary: "Download rendered video", parameters: [{ $ref: "#/components/parameters/RenderId" }], responses: { "200": { description: "Video file" } } },
    },
    "/api/v1/jobs/{jobId}": {
      get: { tags: ["Jobs"], summary: "Get asynchronous job status", parameters: [{ $ref: "#/components/parameters/JobId" }], responses: { "200": { description: "Job status" } } },
      delete: { tags: ["Jobs"], summary: "Cancel asynchronous job", parameters: [{ $ref: "#/components/parameters/JobId" }], responses: { "200": { description: "Cancelled job" } } },
    },
    "/api/v1/jobs/{jobId}/download": {
      get: { tags: ["Jobs"], summary: "Download job output", parameters: [{ $ref: "#/components/parameters/JobId" }], responses: { "200": { description: "Rendered video file" } } },
    },
    "/api/v1/assets": {
      get: { tags: ["Assets"], summary: "List user assets", responses: { "200": { description: "Assets" } } },
      post: { tags: ["Assets"], summary: "Create an asset upload", requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/AssetUploadRequest" } } } }, responses: { "201": { description: "Upload instructions" } } },
    },
    "/api/v1/assets/upload/complete": {
      post: { tags: ["Assets"], summary: "Complete an asset upload", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UploadCompleteRequest" } } } }, responses: { "200": { description: "Ready asset" } } },
    },
    "/api/v1/assets/{assetId}": {
      delete: { tags: ["Assets"], summary: "Delete an asset", parameters: [{ $ref: "#/components/parameters/AssetId" }], responses: { "204": { description: "Deleted" } } },
    },
    "/api/v1/assets/{assetId}/media": {
      get: { tags: ["Assets"], summary: "Stream an asset", parameters: [{ $ref: "#/components/parameters/AssetId" }, { name: "variant", in: "query", schema: { type: "string", enum: ["original", "audio", "poster"] } }, { name: "Range", in: "header", schema: { type: "string", example: "bytes=0-1023" } }], responses: { "200": { description: "Asset stream" }, "206": { description: "Partial asset stream" } } },
    },
    "/api/v1/assets/{assetId}/usage": {
      get: { tags: ["Assets"], summary: "Find asset usage", parameters: [{ $ref: "#/components/parameters/AssetId" }], responses: { "200": { description: "Usage information" } } },
    },
    "/api/v1/fonts": {
      get: { tags: ["Fonts"], summary: "List user fonts", responses: { "200": { description: "Fonts" } } },
      post: { tags: ["Fonts"], summary: "Create a font upload", responses: { "201": { description: "Upload instructions" } } },
    },
    "/api/v1/fonts/upload/complete": {
      post: { tags: ["Fonts"], summary: "Complete a font upload", responses: { "200": { description: "Ready font" } } },
    },
    "/api/v1/fonts/{fontId}": {
      delete: { tags: ["Fonts"], summary: "Delete a font", parameters: [{ $ref: "#/components/parameters/FontId" }], responses: { "204": { description: "Deleted" } } },
    },
    "/api/v1/account/storage": {
      get: { tags: ["System"], summary: "Get storage usage", responses: { "200": { description: "Storage usage" } } },
    },
    "/api/v1/account/avatar": {
      post: {
        tags: ["System"],
        summary: "Upload or replace the current user's avatar",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: { file: { type: "string", format: "binary" } },
              },
            },
          },
        },
        responses: { "200": { description: "Avatar metadata and public URL" }, "401": { $ref: "#/components/responses/Unauthorized" } },
      },
      delete: {
        tags: ["System"],
        summary: "Remove the current user's custom avatar",
        responses: { "200": { description: "Avatar removed" }, "401": { $ref: "#/components/responses/Unauthorized" } },
      },
    },
    "/api/v1/system-assets/{systemAssetId}": {
      get: { tags: ["System"], summary: "Get a system asset", parameters: [{ name: "systemAssetId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "System asset" } } },
    },
    "/api/v1/system-fonts/{fontFileId}": {
      get: { tags: ["System"], summary: "Get a system font", parameters: [{ name: "fontFileId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Font file" } } },
    },
    "/api/v1/previews/video": {
      get: { tags: ["System"], summary: "Proxy a preview video", parameters: [{ name: "id", in: "query", required: true, schema: { type: "string" } }], responses: { "200": { description: "Video stream" } } },
    },
    "/api/auth/callback": {
      get: {
        tags: ["Authentication"],
        summary: "Complete Supabase OAuth login",
        description: "Browser callback. Exchanges the Supabase authorization code for a session and redirects to the safe next path.",
        parameters: [
          { name: "code", in: "query", required: true, schema: { type: "string" } },
          { name: "next", in: "query", schema: { type: "string", example: "/dashboard" } },
        ],
        responses: { "302": { description: "Redirect to the application" }, "400": { description: "Missing or invalid code" } },
      },
    },
    "/api/oauth/decision": {
      post: {
        tags: ["OAuth"],
        summary: "Approve or deny an OAuth authorization request",
        description: "Browser form endpoint used by the Supabase OAuth consent page. This is not a product REST endpoint.",
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                required: ["authorization_id", "decision"],
                properties: { authorization_id: { type: "string" }, decision: { type: "string", enum: ["approve", "deny"] } },
              },
            },
          },
        },
        responses: { "302": { description: "Redirect to the OAuth client" }, "400": { description: "Invalid OAuth decision" } },
      },
    },
    "/api/mcp": {
      get: {
        tags: ["MCP"],
        summary: "Handle an MCP streamable HTTP request",
        description: "Authenticated hosted MCP transport. Clients should use the MCP protocol schema rather than hand-authoring this request.",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "MCP JSON response or stream" }, "401": { $ref: "#/components/responses/Unauthorized" } },
      },
      post: {
        tags: ["MCP"],
        summary: "Send an MCP JSON-RPC request",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: true, description: "MCP JSON-RPC request" } } } },
        responses: { "200": { description: "MCP JSON-RPC response" }, "401": { $ref: "#/components/responses/Unauthorized" } },
      },
      delete: {
        tags: ["MCP"],
        summary: "Send an MCP session control request",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "MCP response" }, "401": { $ref: "#/components/responses/Unauthorized" } },
      },
    },
    "/api/internal/media-jobs/callback": {
      post: {
        tags: ["Internal"],
        summary: "Commit a media worker callback",
        description: "Private worker-to-app callback. Requires the x-internal-worker-token header and verified derivative object keys.",
        security: [{ internalWorkerToken: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/MediaJobCallback" } } } },
        responses: {
          "200": { description: "Callback accepted" },
          "400": { description: "Invalid callback payload" },
          "401": { description: "Invalid worker token" },
          "409": { description: "Job or asset identity conflict" },
        },
      },
    },
    "/api/dev/auth": {
      post: {
        tags: ["Development"],
        summary: "Sign in the configured demo user",
        description: "Available only when NODE_ENV is not production and DEV_DEMO_AUTH=1. Never use this endpoint in production.",
        responses: { "200": { description: "Demo session changed" }, "401": { description: "Demo credentials rejected" }, "404": { description: "Endpoint disabled" }, "503": { description: "Demo credentials are not configured" } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "MCP access token" },
      internalWorkerToken: { type: "apiKey", in: "header", name: "x-internal-worker-token" },
    },
    parameters: {
      Limit: { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
      ProjectId: { name: "projectId", in: "path", required: true, schema: { type: "string" }, description: "Project UUID or public reference" },
      RevisionNo: { name: "revisionNo", in: "path", required: true, schema: { type: "integer", minimum: 1 } },
      RenderId: { name: "id", in: "path", required: true, schema: { type: "string" } },
      JobId: { name: "jobId", in: "path", required: true, schema: { type: "string" } },
      AssetId: { name: "assetId", in: "path", required: true, schema: { type: "string" } },
      FontId: { name: "fontId", in: "path", required: true, schema: { type: "string" } },
    },
    responses: {
      InvalidInput: { description: "Invalid request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      CompilerError: { description: "HTML compiler diagnostics contain errors", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      Unauthorized: { description: "Authentication required", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      NotFound: { description: "Resource not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
    },
    schemas: {
      HtmlDocumentRequest: {
        type: "object",
        required: ["html"],
        properties: { html: { type: "string", description: "One complete Neonix HTML document with inline style blocks and meta[name=neonix-document]", example: "<!doctype html><html><head><meta name=\"neonix-document\" content=\'{\"kind\":\"neonix-html-document\",\"schemaVersion\":2,\"composition\":{\"width\":1920,\"height\":1080,\"fps\":30,\"background\":\"#081018\",\"colorSpace\":\"srgb\"}}\'><style>body{margin:0}</style></head><body><div></div></body></html>" } },
      },
      CreateProjectRequest: { type: "object", required: ["document"], properties: { title: { type: "string", default: "Untitled project" }, workspaceId: { type: "string", format: "uuid" }, document: { type: "object", additionalProperties: true, description: "Neonix JSON V2 document" } } },
      CreateHtmlProjectRequest: { type: "object", required: ["html"], properties: { title: { type: "string", default: "Untitled project" }, workspaceId: { type: "string", format: "uuid" }, html: { type: "string", description: "Complete Neonix HTML document including inline style blocks and meta[name=neonix-document]" }, idempotencyKey: { type: "string", maxLength: 200, description: "Retry key that returns the original project instead of creating a duplicate" } } },
      UpdateProjectRequest: { type: "object", properties: { title: { type: "string" }, document: { type: "object", additionalProperties: true }, expectedRevisionNo: { type: "integer", minimum: 0 } } },
      UpdateHtmlProjectRequest: { type: "object", required: ["html"], properties: { html: { type: "string" }, expectedHtmlRevisionNo: { type: "integer", minimum: 0 }, expectedProtocolRevisionNo: { type: "integer", minimum: 0 } } },
      JsonPatchRequest: { type: "object", required: ["expectedProtocolRevisionNo", "patch"], properties: { expectedProtocolRevisionNo: { type: "integer", minimum: 1 }, patch: { type: "object", additionalProperties: true } } },
      AttachAssetRequest: { type: "object", required: ["assetId"], properties: { assetId: { type: "string" } } },
      RenderRequest: { type: "object", properties: { projectId: { type: "string" }, protocol: { type: "object", additionalProperties: true }, preset: { type: "string", example: "export-1080p" } } },
      AssetUploadRequest: { type: "object", additionalProperties: true },
      UploadCompleteRequest: { type: "object", additionalProperties: true },
      MediaJobCallback: {
        type: "object",
        required: ["jobId", "assetId", "status", "sourceIntegrity", "pipelineVersion", "streams", "derivatives"],
        properties: {
          jobId: { type: "string" },
          assetId: { type: "string" },
          status: { type: "string", enum: ["ready", "partial", "failed"] },
          sourceIntegrity: { type: "string" },
          sourceContentHash: { type: "string" },
          pipelineVersion: { type: "integer", minimum: 1 },
          streams: { type: "array", items: { type: "object", required: ["streamId", "kind"], properties: { streamId: { type: "string" }, kind: { type: "string", enum: ["video", "audio"] } }, additionalProperties: true } },
          derivatives: { type: "array", items: { type: "object", required: ["derivativeId", "kind", "uri", "mimeType", "version"], properties: { derivativeId: { type: "string" }, kind: { type: "string", enum: ["audio", "poster", "video-proxy"] }, uri: { type: "string" }, mimeType: { type: "string" }, version: { type: "integer", minimum: 1 } }, additionalProperties: true } },
          error: { type: "string" },
        },
      },
      ValidationResponse: { type: "object", properties: { valid: { type: "boolean" }, composition: { type: "object", additionalProperties: true }, diagnostics: { type: "array", items: { type: "object", additionalProperties: true } }, stats: { type: "object", additionalProperties: true } } },
      CompileResponse: { type: "object", properties: { status: { type: "string", example: "succeeded" }, protocolVersion: { type: "integer", example: 2 }, composition: { type: "object", additionalProperties: true }, protocol: { type: "object", additionalProperties: true }, diagnostics: { type: "array", items: { type: "object", additionalProperties: true } } } },
      ErrorResponse: { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, details: { type: "array", items: {} }, requestId: { type: "string" } } } } },
    },
  },
} as const;
