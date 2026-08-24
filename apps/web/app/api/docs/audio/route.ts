import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const runtime = "nodejs";

const AUDIO_FILE = "Music-MBB-Island-Tropical_128k.mp3";

function audioFilePath(): string {
  return resolve(process.cwd(), "..", "..", "assets", "music", AUDIO_FILE);
}

export async function GET() {
  try {
    const bytes = await readFile(audioFilePath());
    return new Response(bytes, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(bytes.byteLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": `inline; filename="${AUDIO_FILE}"`,
      },
    });
  } catch {
    return Response.json({ error: "Audio fixture unavailable" }, { status: 404 });
  }
}
