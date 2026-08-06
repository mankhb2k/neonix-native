/**
 * Server-only Remotion Lambda client (pin 4.0.506).
 * Credentials never leave the server; serveUrl/functionName come from env only.
 */

import "server-only";

import type { PersistentRenderJob } from "@/lib/server/render/job-store";
import {
  saveRenderJob,
  updateRenderJob,
} from "@/lib/server/render/job-store";
import type { RenderManifest } from "@motionvideo/render-contracts";

export type LambdaRenderStartResult = {
  renderId: string;
  bucketName: string;
};

function lambdaConfigured(): boolean {
  return Boolean(
    process.env.REMOTION_FUNCTION_NAME &&
      process.env.REMOTION_SERVE_URL &&
      process.env.AWS_REGION,
  );
}

/**
 * Start a private Lambda render. When AWS env is unset, runs a durable local
 * stub so BFF persistence/idempotency can be tested without credentials.
 */
export async function startRenderOnLambda(input: {
  job: PersistentRenderJob;
  manifest: RenderManifest;
}): Promise<LambdaRenderStartResult> {
  if (!lambdaConfigured()) {
    const renderId = `local_${input.job.jobId}`;
    const bucketName = "local-private";
    await updateRenderJob(input.job.jobId, {
      status: "rendering",
      progress: 0.1,
      stage: "lambda-stub",
      lambdaRenderId: renderId,
      bucketName,
      outputKey: `renders/${input.job.jobId}/out.mp4`,
    });
    // Simulate async completion for stub path
    void (async () => {
      await new Promise((r) => setTimeout(r, 25));
      await updateRenderJob(input.job.jobId, {
        status: "done",
        progress: 1,
        stage: "done",
        artifactPath: `stub://${input.job.jobId}.mp4`,
      });
    })();
    return { renderId, bucketName };
  }

  const { renderMediaOnLambda } = await import("@remotion/lambda-client");
  const result = await renderMediaOnLambda({
    region: process.env.AWS_REGION as "us-east-1",
    functionName: process.env.REMOTION_FUNCTION_NAME!,
    serveUrl: process.env.REMOTION_SERVE_URL!,
    composition: "MotiClipVideo",
    inputProps: {
      manifest: input.manifest,
    },
    codec: input.manifest.output.codec === "prores" ? "prores" : "h264",
    privacy: "private",
    framesPerLambda: 20,
  });

  await updateRenderJob(input.job.jobId, {
    status: "rendering",
    progress: 0.05,
    stage: "lambda",
    lambdaRenderId: result.renderId,
    bucketName: result.bucketName,
  });

  return {
    renderId: result.renderId,
    bucketName: result.bucketName,
  };
}

export async function cancelLambdaRender(job: PersistentRenderJob): Promise<void> {
  if (!job.lambdaRenderId || !lambdaConfigured()) {
    await updateRenderJob(job.jobId, {
      status: "cancelled",
      progress: 0,
      stage: "cancelled",
    });
    return;
  }
  const { cancelRender } = await import("@remotion/lambda-client");
  await cancelRender({
    region: process.env.AWS_REGION as "us-east-1",
    functionName: process.env.REMOTION_FUNCTION_NAME!,
    bucketName: job.bucketName!,
    renderId: job.lambdaRenderId,
  });
  await updateRenderJob(job.jobId, {
    status: "cancelled",
    progress: 0,
    stage: "cancelled",
  });
}

/** Re-export for tests that need to touch the same module. */
export { saveRenderJob };
