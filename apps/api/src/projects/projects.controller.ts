import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { CurrentUserGuard } from "../auth/current-user.guard";
import { ApiError } from "../common/api-error";
import { CreateHtmlProjectDto } from "./dto/create-html-project.dto";
import { CreateProjectDto } from "./dto/create-project.dto";
import { CreateRevisionDto } from "./dto/create-revision.dto";
import { UpdateHtmlDocumentDto } from "./dto/update-html-document.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectsService } from "./projects.service";

@UseGuards(CurrentUserGuard)
@Controller("v1/projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  async list(@CurrentUser() userId: string, @Query("workspaceId") workspaceId?: string) {
    if (!workspaceId) throw new ApiError(400, "workspaceId query param is required");
    return { projects: await this.projects.list(userId, workspaceId) };
  }

  @Post()
  async create(@CurrentUser() userId: string, @Body() dto: CreateProjectDto) {
    return { project: await this.projects.create(userId, dto.workspaceId, dto.title) };
  }

  // Track A (raw HTML) project - see ProjectsService's "Track A" section.
  @Post("html-raw")
  async createHtmlProject(@CurrentUser() userId: string, @Body() dto: CreateHtmlProjectDto) {
    const result = await this.projects.createHtmlProject(userId, dto);
    return { project: result.project, alreadyCreated: result.alreadyCreated };
  }

  @Get(":id")
  async get(@CurrentUser() userId: string, @Param("id") id: string) {
    return { project: await this.projects.getForMember(userId, id) };
  }

  @Patch(":id")
  async update(@CurrentUser() userId: string, @Param("id") id: string, @Body() dto: UpdateProjectDto) {
    return { project: await this.projects.update(userId, id, dto.title) };
  }

  @Delete(":id")
  async softDelete(@CurrentUser() userId: string, @Param("id") id: string) {
    return { project: await this.projects.softDelete(userId, id) };
  }

  @Post(":id/restore")
  @HttpCode(200)
  async restore(@CurrentUser() userId: string, @Param("id") id: string) {
    return { project: await this.projects.restore(userId, id) };
  }

  @Get(":id/revisions")
  async listRevisions(@CurrentUser() userId: string, @Param("id") id: string) {
    return { revisions: await this.projects.listRevisions(userId, id) };
  }

  @Get(":id/revisions/:revisionNo")
  async getRevision(@CurrentUser() userId: string, @Param("id") id: string, @Param("revisionNo") revisionNo: string) {
    return { revision: await this.projects.getRevision(userId, id, Number(revisionNo)) };
  }

  @Post(":id/revisions")
  async createRevision(@CurrentUser() userId: string, @Param("id") id: string, @Body() dto: CreateRevisionDto) {
    return {
      revision: await this.projects.createRevision(userId, id, dto.documentJson, dto.reason ?? "manual"),
    };
  }

  // Track A (raw HTML) project - current document only, no revision history.
  @Get(":id/html")
  async getHtmlDocument(@CurrentUser() userId: string, @Param("id") id: string) {
    const result = await this.projects.getHtmlDocument(userId, id);
    return { project: result.project, html: result.html, updatedAt: result.updatedAt };
  }

  @Put(":id/html")
  async updateHtmlDocument(@CurrentUser() userId: string, @Param("id") id: string, @Body() dto: UpdateHtmlDocumentDto) {
    const result = await this.projects.updateHtmlDocument(userId, id, dto.html);
    return { project: result.project, html: result.html, updatedAt: result.updatedAt };
  }

  // Bridges Track A -> Track B by creating a brand new, separate project.
  @Post(":id/convert-json")
  async convertToJsonProject(@CurrentUser() userId: string, @Param("id") id: string) {
    const result = await this.projects.convertHtmlToJsonProject(userId, id);
    return {
      project: result.project,
      revision: result.revision,
      sourceProjectId: result.sourceProjectId,
      diagnostics: result.diagnostics,
    };
  }
}
