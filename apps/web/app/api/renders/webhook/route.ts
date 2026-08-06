import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getRenderJob,
  updateRenderJob,
} from "@/lib/server/render/job-store";
import { RenderWebhookPayloadSchema } from "@motionvideo/render-contracts";

export const runtime = "nodejs";

function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.REMOTION_WEBHOOK_SECRET;
  if (!secret) {
    // Reject forged webhooks when secret is configured; allow unsigned only in
    // explicit dev mode.
    return process.env.NODE_ENV !== "production";
  }
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.replace(/^sha256=/, "");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature =
    request.headers.get("x-remotion-signature") ??
    request.headers.get("x-webhook-signature");
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const payload = RenderWebhookPayloadSchema.parse(json);
  const job = await getRenderJob(payload.jobId);
  if (!job) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (payload.status === "done") {
    await updateRenderJob(job.jobId, {
      status: "done",
      progress: 1,
      stage: "done",
      bucketName: payload.bucketName ?? job.bucketName,
      outputKey: payload.outputKey ?? job.outputKey,
      lambdaRenderId: payload.renderId ?? job.lambdaRenderId,
    });
  } else if (payload.status === "failed") {
    await updateRenderJob(job.jobId, {
      status: "failed",
      error: payload.error ?? "lambda_failed",
      stage: "failed",
    });
  } else {
    await updateRenderJob(job.jobId, {
      status: "cancelled",
      stage: "cancelled",
    });
  }

  return NextResponse.json({ ok: true });
}
