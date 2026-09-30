import { randomUUID } from "node:crypto";
import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import type { Queue } from "bullmq";
import { and, desc, eq, sql } from "drizzle-orm";
import { AuthzService } from "../authz/authz.service";
import { ApiError } from "../common/api-error";
import { isUniqueViolation } from "../common/pg-errors";
import type { Database } from "../db/client";
import { DATABASE } from "../db/database.module";
import { projectRevisions, projects } from "../db/schema/projects";
import { renderJobs } from "../db/schema/render";
import { R2Service } from "../r2/r2.service";
import type { RenderJobPayload } from "./render-worker.processor";

const TERMINAL_STATUSES = new Set(["done", "failed", "cancelled"]);
const DOWNLOAD_URL_TTL_SECONDS = 60;

@Injectable()
export class RenderJobsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly authz: AuthzService,
    private readonly r2: R2Service,
    @InjectQueue("render-jobs") private readonly queue: Queue<RenderJobPayload>,
  ) {}

  async create(
    userId: string,
    input: { projectId: string; revisionId?: string; idempotencyKey?: string; presetJson?: Record<string, unknown> },
  ) {
    const project = await this.db.query.projects.findFirst({ where: eq(projects.id, input.projectId) });
    if (!project || project.deletedAt) throw new ApiError(404, "Project not found");
    const canEdit = await this.authz.hasWorkspaceRole(userId, project.workspaceId, "editor");
    if (!canEdit) throw new ApiError(404, "Project not found");

    const revision = input.revisionId
      ? await this.db.query.projectRevisions.findFirst({
        where: and(eq(projectRevisions.id, input.revisionId), eq(projectRevisions.projectId, project.id)),
      })
      : await this.db.query.projectRevisions.findFirst({
        where: eq(projectRevisions.projectId, project.id),
        orderBy: desc(projectRevisions.revisionNo),
      });
    if (!revision) {
      throw new ApiError(422, "Project has no revision to render (or revisionId doesn't belong to it)", "no_revision");
    }

    const idempotencyKey = input.idempotencyKey ?? randomUUID();

    let renderJob;
    try {
      [renderJob] = await this.db
        .insert(renderJobs)
        .values({
          workspaceId: project.workspaceId,
          projectId: project.id,
          revisionId: revision.id,
          createdBy: userId,
          idempotencyKey,
          presetJson: input.presetJson ?? {},
        })
        .returning();
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existing = await this.db.query.renderJobs.findFirst({
          where: and(eq(renderJobs.workspaceId, project.workspaceId), eq(renderJobs.idempotencyKey, idempotencyKey)),
        });
        return { renderJob: existing, idempotent: true, created: false };
      }
      throw error;
    }

    await this.queue.add("dispatch", { jobId: renderJob.publicRef });
    return { renderJob, idempotent: false, created: true };
  }

  async list(userId: string, workspaceId: string) {
    const canView = await this.authz.hasWorkspaceRole(userId, workspaceId, "viewer");
    if (!canView) throw new ApiError(404, "Workspace not found");
    return this.db.query.renderJobs.findMany({
      where: eq(renderJobs.workspaceId, workspaceId),
      orderBy: desc(renderJobs.createdAt),
    });
  }

  async getForMember(userId: string, id: string) {
    const job = await this.db.query.renderJobs.findFirst({ where: eq(renderJobs.id, id) });
    if (!job) throw new ApiError(404, "Render job not found");
    const canView = await this.authz.hasWorkspaceRole(userId, job.workspaceId, "viewer");
    if (!canView) throw new ApiError(404, "Render job not found");
    return job;
  }

  // Original RLS restricted this to the job's own creator (`created_by =
  // auth.uid()`), not just any workspace editor - replicated as-is.
  async cancel(userId: string, id: string) {
    const job = await this.db.query.renderJobs.findFirst({ where: eq(renderJobs.id, id) });
    if (!job || job.createdBy !== userId) throw new ApiError(404, "Render job not found");
    if (TERMINAL_STATUSES.has(job.status)) {
      throw new ApiError(409, `Render job already in a terminal state: ${job.status}`);
    }
    const [updated] = await this.db
      .update(renderJobs)
      .set({ cancelRequested: true, updatedAt: sql`now()` })
      .where(eq(renderJobs.id, job.id))
      .returning();
    return updated;
  }

  // Presigned, short-lived (60s) GET url for the finished MP4. No on-demand
  // resync against the Cloud Run provider here (unlike the old apps/web
  // route's `syncRenderJob`) - the BullMQ worker already keeps `status`/
  // `outputKey` current asynchronously, so `render_jobs` is the live source
  // of truth for a read like this.
  async getDownloadUrl(userId: string, id: string) {
    const job = await this.getForMember(userId, id);
    if (job.status !== "done") throw new ApiError(409, `Render job is not finished yet: ${job.status}`, "not_ready");
    if (!job.outputKey) throw new ApiError(404, "Render job has no output file");

    const signed = await this.r2.presignGet("R2_USER_EXPORTS_BUCKET", job.outputKey, DOWNLOAD_URL_TTL_SECONDS);
    return { url: signed.url, expiresAt: signed.expiresAt, ttlSeconds: DOWNLOAD_URL_TTL_SECONDS };
  }
}
