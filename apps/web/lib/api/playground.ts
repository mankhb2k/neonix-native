import { apiFetch } from "./client";

export async function fetchPlaygroundFixture(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, signal ? { signal } : undefined);
  if (!response.ok) throw new Error(`Fixture request failed: ${response.status}`);
  return response.text();
}

export type PlaygroundCompileDiagnostic = {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  source?: unknown;
  selector?: string;
  property?: string;
  elementId?: string;
};

export type PlaygroundCompileSuccess = {
  ok: true;
  protocol: Record<string, unknown>;
  composition: { width: number; height: number; fps: number; background: string; colorSpace: string };
  diagnostics: PlaygroundCompileDiagnostic[];
};

export type PlaygroundCompileFailure = {
  ok: false;
  message: string;
  diagnostics: PlaygroundCompileDiagnostic[];
};

/**
 * Calls the public, unauthenticated compile endpoint in apps/api.
 */
export async function compileHtmlViaApi(html: string, signal?: AbortSignal): Promise<PlaygroundCompileSuccess | PlaygroundCompileFailure> {
  let response: Response;
  try {
    response = await apiFetch("/v1/documents/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html }),
      signal,
    });
  } catch {
    return { ok: false, message: "Unable to reach the compile API. Check your connection and try again.", diagnostics: [] };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, message: `Compile request failed (HTTP ${response.status})`, diagnostics: [] };
  }
  if (!response.ok) {
    const error = (body as { error?: { message?: string; details?: unknown } } | null)?.error;
    const diagnostics = Array.isArray(error?.details) ? error.details as PlaygroundCompileDiagnostic[] : [];
    return {
      ok: false,
      message: response.status === 429
        ? "Too many compile requests. Please wait a moment and try again."
        : (error?.message ?? `Compile request failed (HTTP ${response.status})`),
      diagnostics,
    };
  }
  const success = body as { protocol: Record<string, unknown>; composition: PlaygroundCompileSuccess["composition"]; diagnostics: PlaygroundCompileDiagnostic[] };
  return { ok: true, protocol: success.protocol, composition: success.composition, diagnostics: success.diagnostics ?? [] };
}
