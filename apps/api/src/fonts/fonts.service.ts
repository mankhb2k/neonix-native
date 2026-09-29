import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { AuthzService } from "../authz/authz.service";
import { ApiError } from "../common/api-error";
import type { Database } from "../db/client";
import { DATABASE } from "../db/database.module";
import { assets } from "../db/schema/assets";
import { projectFontFamilies, userFontFaces, userFontFamilies } from "../db/schema/fonts";
import { projects } from "../db/schema/projects";
import { isUniqueViolation } from "../common/pg-errors";

@Injectable()
export class FontsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly authz: AuthzService,
  ) {}

  private async loadFamilyForMember(userId: string, familyId: string) {
    const family = await this.db.query.userFontFamilies.findFirst({ where: eq(userFontFamilies.id, familyId) });
    if (!family) return null;
    const isMember = await this.authz.hasWorkspaceRole(userId, family.workspaceId, "viewer");
    if (!isMember) return null;
    return family;
  }

  async listFamilies(userId: string, workspaceId: string) {
    const canView = await this.authz.hasWorkspaceRole(userId, workspaceId, "viewer");
    if (!canView) throw new ApiError(404, "Workspace not found");
    return this.db.query.userFontFamilies.findMany({ where: eq(userFontFamilies.workspaceId, workspaceId) });
  }

  async createFamily(userId: string, input: { workspaceId: string; slug: string; familyName: string }) {
    const canEdit = await this.authz.hasWorkspaceRole(userId, input.workspaceId, "editor");
    if (!canEdit) throw new ApiError(404, "Workspace not found");
    try {
      const [family] = await this.db
        .insert(userFontFamilies)
        .values({ workspaceId: input.workspaceId, slug: input.slug, familyName: input.familyName.trim(), createdBy: userId })
        .returning();
      return family;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApiError(409, "A font family with that slug or name already exists in this workspace", "font_family_conflict");
      }
      throw error;
    }
  }

  async getFamily(userId: string, familyId: string) {
    const family = await this.loadFamilyForMember(userId, familyId);
    if (!family) throw new ApiError(404, "Font family not found");
    return family;
  }

  async deleteFamily(userId: string, familyId: string) {
    const family = await this.loadFamilyForMember(userId, familyId);
    if (!family) throw new ApiError(404, "Font family not found");
    const canEdit = await this.authz.hasWorkspaceRole(userId, family.workspaceId, "editor");
    if (!canEdit) throw new ApiError(403, "Editor role required");
    await this.db.delete(userFontFamilies).where(eq(userFontFamilies.id, family.id));
  }

  async listFaces(userId: string, familyId: string) {
    const family = await this.loadFamilyForMember(userId, familyId);
    if (!family) throw new ApiError(404, "Font family not found");
    return this.db.query.userFontFaces.findMany({ where: eq(userFontFaces.fontFamilyId, family.id) });
  }

  // Replaces `validate_user_font_asset()`: the asset must be a live, ready
  // `kind = 'font'` asset in the SAME workspace as the font family.
  async createFace(
    userId: string,
    familyId: string,
    input: { assetId: string; faceKey: string; weight: number; style: string; widthClass: string; format: string },
  ) {
    const family = await this.db.query.userFontFamilies.findFirst({ where: eq(userFontFamilies.id, familyId) });
    if (!family) throw new ApiError(404, "Font family not found");
    const canEdit = await this.authz.hasWorkspaceRole(userId, family.workspaceId, "editor");
    if (!canEdit) throw new ApiError(404, "Font family not found");

    const asset = await this.db.query.assets.findFirst({ where: eq(assets.id, input.assetId) });
    if (!asset || asset.kind !== "font" || asset.status !== "ready" || asset.deletedAt || asset.workspaceId !== family.workspaceId) {
      throw new ApiError(422, "Asset must be a live, ready font asset in the same workspace as the font family", "invalid_font_asset");
    }

    try {
      return await this.db
        .insert(userFontFaces)
        .values({
          fontFamilyId: family.id,
          assetId: input.assetId,
          faceKey: input.faceKey,
          weight: input.weight,
          style: input.style,
          widthClass: input.widthClass,
          format: input.format,
        })
        .returning()
        .then(([face]) => face);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApiError(409, "A face with that key already exists on this family, or the asset is already used by another face", "font_face_conflict");
      }
      throw error;
    }
  }

  async deleteFace(userId: string, faceId: string) {
    const face = await this.db.query.userFontFaces.findFirst({ where: eq(userFontFaces.id, faceId) });
    if (!face) throw new ApiError(404, "Font face not found");
    const family = await this.db.query.userFontFamilies.findFirst({ where: eq(userFontFamilies.id, face.fontFamilyId) });
    const canEdit = family && (await this.authz.hasWorkspaceRole(userId, family.workspaceId, "editor"));
    if (!canEdit) throw new ApiError(404, "Font face not found");
    await this.db.delete(userFontFaces).where(eq(userFontFaces.id, face.id));
  }

  // Replaces `validate_project_user_font_family()`: the project and the
  // font family must belong to the same workspace.
  async createProjectLink(userId: string, input: { projectId: string; fontFamilyId: string; alias: string | null }) {
    const [project, family] = await Promise.all([
      this.db.query.projects.findFirst({ where: eq(projects.id, input.projectId) }),
      this.db.query.userFontFamilies.findFirst({ where: eq(userFontFamilies.id, input.fontFamilyId) }),
    ]);
    if (!project || !family || project.workspaceId !== family.workspaceId) {
      throw new ApiError(422, "Project and font family must belong to the same workspace", "workspace_mismatch");
    }
    const canEdit = await this.authz.hasWorkspaceRole(userId, project.workspaceId, "editor");
    if (!canEdit) throw new ApiError(404, "Project not found");

    const [link] = await this.db
      .insert(projectFontFamilies)
      .values({ projectId: input.projectId, fontFamilyId: input.fontFamilyId, alias: input.alias, createdBy: userId })
      .onConflictDoNothing()
      .returning();
    return link ?? { projectId: input.projectId, fontFamilyId: input.fontFamilyId, alias: input.alias };
  }

  async listProjectLinks(userId: string, projectId: string) {
    const project = await this.db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) throw new ApiError(404, "Project not found");
    const canView = await this.authz.hasWorkspaceRole(userId, project.workspaceId, "viewer");
    if (!canView) throw new ApiError(404, "Project not found");
    return this.db.query.projectFontFamilies.findMany({ where: eq(projectFontFamilies.projectId, projectId) });
  }

  async deleteProjectLink(userId: string, projectId: string, fontFamilyId: string) {
    const project = await this.db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) throw new ApiError(404, "Project not found");
    const canEdit = await this.authz.hasWorkspaceRole(userId, project.workspaceId, "editor");
    if (!canEdit) throw new ApiError(404, "Project not found");
    await this.db
      .delete(projectFontFamilies)
      .where(and(eq(projectFontFamilies.projectId, projectId), eq(projectFontFamilies.fontFamilyId, fontFamilyId)));
  }
}
