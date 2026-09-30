import { apiFetch } from "./client";

export type Workspace = {
  id: string;
  name: string;
  kind: string;
  role: string;
};

let defaultWorkspacePromise: Promise<string> | null = null;

export async function getDefaultWorkspaceId(): Promise<string> {
  defaultWorkspacePromise ??= (async () => {
    const response = await apiFetch("/v1/workspaces", { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load workspaces (${response.status})`);
    const body = (await response.json()) as { workspaces?: Workspace[] };
    const workspace = body.workspaces?.find((item) => item.kind === "personal") ?? body.workspaces?.[0];
    if (!workspace?.id) throw new Error("No workspace is available for this account");
    return workspace.id;
  })();

  try {
    return await defaultWorkspacePromise;
  } catch (error) {
    defaultWorkspacePromise = null;
    throw error;
  }
}
