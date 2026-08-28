import type {
  CompleteUploadResponse,
  CreateUploadRequest,
  CreateUploadResponse,
  DownloadUrlResponse,
  ValidateAssetsRequest,
  ValidateAssetsResponse,
  StorageAsset,
} from "./types";

export type AssetStorageClientOptions = {
  baseUrl: string;
  getAuthHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  fetch?: typeof fetch;
};

export type AssetStorageClient = {
  createUpload: (input: CreateUploadRequest) => Promise<CreateUploadResponse>;
  uploadBytes: (uploadUrl: string, body: Buffer | Uint8Array, headers?: Record<string, string>) => Promise<void>;
  completeUpload: (assetId: string) => Promise<CompleteUploadResponse>;
  getDownloadUrl: (assetId: string) => Promise<DownloadUrlResponse>;
  validateAssets: (assets: StorageAsset[]) => Promise<ValidateAssetsResponse>;
  deleteAsset: (assetId: string) => Promise<void>;
  /**
   * Convenience: create → PUT bytes → complete → StorageAsset.
   */
  ingestBytes: (
    input: CreateUploadRequest,
    body: Buffer | Uint8Array,
  ) => Promise<StorageAsset>;
};

async function readError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    return json.error?.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export function createAssetStorageClient(
  options: AssetStorageClientOptions,
): AssetStorageClient {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetchImpl = options.fetch ?? fetch;

  async function authHeaders(): Promise<Record<string, string>> {
    return (await options.getAuthHeaders?.()) ?? {};
  }

  async function request<T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const headers = {
      ...(await authHeaders()),
      ...(init?.headers as Record<string, string> | undefined),
    };
    const res = await fetchImpl(`${baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      throw new Error(`Asset API ${path} failed (${res.status}): ${await readError(res)}`);
    }
    if (res.status === 204) {
      return undefined as T;
    }
    return (await res.json()) as T;
  }

  const client: AssetStorageClient = {
    createUpload: (input) =>
      request<CreateUploadResponse>("/assets/uploads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),

    uploadBytes: async (uploadUrl, body, headers = {}) => {
      const res = await fetchImpl(uploadUrl, {
        method: "PUT",
        headers: {
          ...(await authHeaders()),
          ...headers,
        },
        body: body as BodyInit,
      });
      if (!res.ok) {
        throw new Error(
          `Asset upload PUT failed (${res.status}): ${await readError(res)}`,
        );
      }
    },

    completeUpload: (assetId) =>
      request<CompleteUploadResponse>(`/assets/uploads/${encodeURIComponent(assetId)}/complete`, {
        method: "POST",
      }),

    getDownloadUrl: (assetId) =>
      request<DownloadUrlResponse>(
        `/assets/${encodeURIComponent(assetId)}/download-url`,
      ),

    validateAssets: (assets) =>
      request<ValidateAssetsResponse>("/assets/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assets } satisfies ValidateAssetsRequest),
      }),

    deleteAsset: (assetId) =>
      request<void>(`/assets/${encodeURIComponent(assetId)}`, {
        method: "DELETE",
      }),

    ingestBytes: async (input, body) => {
      const session = await client.createUpload(input);
      await client.uploadBytes(session.uploadUrl, body, session.headers);
      const completed = await client.completeUpload(session.assetId);
      return completed.asset;
    },
  };

  return client;
}
