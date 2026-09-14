export type McpPermission = {
  scope: string;
  label: string;
  description: string;
  destructive?: boolean;
};

export type McpPermissionGroup = {
  id: "account" | "projects" | "assets" | "exports";
  label: string;
  description: string;
  permissions: readonly McpPermission[];
};

export const MCP_STANDARD_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
] as const;

export const MCP_PERMISSION_GROUPS: readonly McpPermissionGroup[] = [
  {
    id: "account",
    label: "Account access",
    description: "Basic identity details used to connect your Neonix account.",
    permissions: [
      { scope: "openid", label: "Identity", description: "Confirm your Neonix identity." },
      { scope: "profile", label: "Profile", description: "Read your profile information." },
      { scope: "email", label: "Email address", description: "Read the email associated with your account." },
      { scope: "offline_access", label: "Refresh access", description: "Keep the connection active without signing in again." },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    description: "Create and manage editable motion projects in your workspace.",
    permissions: [
      { scope: "projects:read", label: "View projects", description: "List projects, revisions, HTML, JSON, and compiler capabilities." },
      { scope: "projects:write", label: "Create and edit projects", description: "Create, update, compile, and patch project content." },
      { scope: "projects:delete", label: "Delete projects", description: "Permanently delete projects from the workspace.", destructive: true },
    ],
  },
  {
    id: "assets",
    label: "Assets",
    description: "Use media and font assets in your motion projects.",
    permissions: [
      { scope: "assets:read", label: "View assets", description: "List assets available to your workspace." },
      { scope: "assets:write", label: "Upload and attach assets", description: "Upload, import, and attach assets to projects." },
      { scope: "assets:delete", label: "Delete assets", description: "Permanently delete workspace assets.", destructive: true },
    ],
  },
  {
    id: "exports",
    label: "Exports",
    description: "Render, inspect, download, and manage exported videos.",
    permissions: [
      { scope: "exports:read", label: "View and download exports", description: "Read export status and download completed files." },
      { scope: "exports:write", label: "Create exports", description: "Start new video render jobs." },
      { scope: "exports:delete", label: "Cancel exports", description: "Cancel active export jobs.", destructive: true },
    ],
  },
];

export const MCP_OPERATION_SCOPES = MCP_PERMISSION_GROUPS
  .filter((group) => group.id !== "account")
  .flatMap((group) => group.permissions.map((permission) => permission.scope));
