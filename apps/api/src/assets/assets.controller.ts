import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { CurrentUserGuard } from "../auth/current-user.guard";
import { ApiError } from "../common/api-error";
import { AssetsService } from "./assets.service";
import { CompleteUploadDto } from "./dto/complete-upload.dto";
import { CreateUploadRequestDto } from "./dto/create-upload-request.dto";

@UseGuards(CurrentUserGuard)
@Controller("v1/assets")
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Post("upload-requests")
  async createUploadRequest(@CurrentUser() userId: string, @Body() dto: CreateUploadRequestDto) {
    return this.assets.createUploadRequest(userId, {
      workspaceId: dto.workspaceId,
      mimeType: dto.mimeType,
      byteSize: dto.byteSize,
      kind: dto.kind ?? "other",
      originalFilename: dto.originalFilename ?? null,
    });
  }

  @Post(":id/complete")
  @HttpCode(200)
  async completeUpload(@CurrentUser() userId: string, @Param("id") id: string, @Body() dto: CompleteUploadDto) {
    return { asset: await this.assets.completeUpload(userId, id, dto.contentHash) };
  }

  @Get()
  async list(@CurrentUser() userId: string, @Query("workspaceId") workspaceId?: string) {
    if (!workspaceId) throw new ApiError(400, "workspaceId query param is required");
    return { assets: await this.assets.list(userId, workspaceId) };
  }

  @Get(":id")
  async get(@CurrentUser() userId: string, @Param("id") id: string) {
    return { asset: await this.assets.getForMember(userId, id) };
  }

  @Delete(":id")
  async softDelete(@CurrentUser() userId: string, @Param("id") id: string) {
    return { asset: await this.assets.softDelete(userId, id) };
  }
}
