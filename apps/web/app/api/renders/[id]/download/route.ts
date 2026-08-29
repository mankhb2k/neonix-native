import { NextResponse } from "next/server";
import { assertJobOwner, getRenderJob } from "@/lib/server/render/job-store";
import { resolveRequestUserId } from "@/lib/server/render/ownership";
import { getUserExportsProvider } from "@/lib/server/r2";
import { syncRenderJob } from "@/lib/server/render/export-worker";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
const DOWNLOAD_TTL_SECONDS = 60;

export async function GET(request: Request, context: Ctx) {
  const { id } = await context.params;
  const userId = resolveRequestUserId(request);
  const job = await getRenderJob(id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try { assertJobOwner(job, userId); } catch { return NextResponse.json({ error: "forbidden" }, { status: 403 }); }
  const refreshed = await syncRenderJob(job);
  if (refreshed.status !== "done") return NextResponse.json({ error: "not_ready" }, { status: 409 });
  const expiresAt = Date.now() + DOWNLOAD_TTL_SECONDS * 1000;
  if (refreshed.outputKey && refreshed.artifactPath?.startsWith("r2://")) {
    const signed = await getUserExportsProvider().presignGet(refreshed.outputKey, DOWNLOAD_TTL_SECONDS);
    return NextResponse.json({ url: signed.url, expiresAt: signed.expiresAt.getTime(), ttlSeconds: DOWNLOAD_TTL_SECONDS });
  }
  const token = Buffer.from(refreshed.jobId + ":" + userId + ":" + expiresAt, "utf8").toString("base64url");
  const url = refreshed.artifactPath?.startsWith("http") ? refreshed.artifactPath : "/api/renders/" + refreshed.jobId + "/download?token=" + token + "&expires=" + expiresAt;
  return NextResponse.json({ url, expiresAt, ttlSeconds: DOWNLOAD_TTL_SECONDS });
}
