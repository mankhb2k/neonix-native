import type { EncodedFile } from "../ffmpeg";

/** Local stub — returns file:// URLs until R2/S3 is wired */
export async function uploadOutputs(files: EncodedFile[]): Promise<string[]> {
  return files.map((f) => {
    const normalized = f.path.replace(/\\/g, "/");
    return normalized.startsWith("file:")
      ? normalized
      : `file://${normalized.startsWith("/") ? "" : "/"}${normalized}`;
  });
}
