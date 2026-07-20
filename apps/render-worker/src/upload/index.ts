import type { EncodedFile } from "../ffmpeg";

/** Placeholder for R2/S3 upload */
export async function uploadOutputs(files: EncodedFile[]): Promise<string[]> {
  return files.map((f) => `https://cdn.example.com/${f.path}`);
}
