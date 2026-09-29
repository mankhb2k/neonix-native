import { Body, Controller, Get, HttpCode, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { CurrentUserGuard } from "../auth/current-user.guard";
import { ApiError } from "../common/api-error";
import { CreateRenderJobDto } from "./dto/create-render-job.dto";
import { RenderJobsService } from "./render-jobs.service";

@UseGuards(CurrentUserGuard)
@Controller("v1/render-jobs")
export class RenderJobsController {
  constructor(private readonly renderJobs: RenderJobsService) {}

  @Post()
  async create(
    @CurrentUser() userId: string,
    @Body() dto: CreateRenderJobDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.renderJobs.create(userId, dto);
    if (result.idempotent) {
      // A retried request with the same idempotencyKey returns the
      // *original* job with 200, not a new 202 - matches how an
      // idempotency key is supposed to behave on retry.
      res.status(200);
      return { renderJob: result.renderJob, idempotent: true };
    }
    res.status(202);
    return { renderJob: result.renderJob };
  }

  @Get()
  async list(@CurrentUser() userId: string, @Query("workspaceId") workspaceId?: string) {
    if (!workspaceId) throw new ApiError(400, "workspaceId query param is required");
    return { renderJobs: await this.renderJobs.list(userId, workspaceId) };
  }

  @Get(":id")
  async get(@CurrentUser() userId: string, @Param("id") id: string) {
    return { renderJob: await this.renderJobs.getForMember(userId, id) };
  }

  @Post(":id/cancel")
  @HttpCode(200)
  async cancel(@CurrentUser() userId: string, @Param("id") id: string) {
    return { renderJob: await this.renderJobs.cancel(userId, id) };
  }
}
