import { NextResponse } from "next/server";
import {
  assertJobOwner,
  getRenderJob,
} from "@/lib/server/render/job-store";
import { resolveRequestUserId } from "@/lib/server/render/ownership";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const DOWNLOAD_TTL_MS = 60_000;

/**
 * Short-TTL download URL for private outputs.
 * Cross-user access is denied via ownership check.
 */
export async function GET(request: Request, context: Ctx) {
  const { id } = await context.params;
  const userId = resolveRequestUserId(request);
  const job = await getRenderJob(id);
  if (!job) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    assertJobOwner(job, userId);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (job.status !== "done") {
    return NextResponse.json({ error: "not_ready" }, { status: 409 });
  }

  const expiresAt = Date.now() + DOWNLOAD_TTL_MS;
  const token = Buffer.from(
    `${job.jobId}:${userId}:${expiresAt}`,
    "utf8",
  ).toString("base64url");

  // Presigned-style stub — real S3 getSignedUrl wired when AWS is configured.
  const url =
    job.artifactPath?.startsWith("http")
      ? job.artifactPath
      : `/api/renders/${job.jobId}/download?token=${token}&expires=${expiresAt}`;

  return NextResponse.json({
    url,
    expiresAt,
    ttlSeconds: Math.floor(DOWNLOAD_TTL_MS / 1000),
  });
}
