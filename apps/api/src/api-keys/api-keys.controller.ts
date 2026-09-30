import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { CurrentUserGuard } from "../auth/current-user.guard";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { ApiKeysService } from "./api-keys.service";

@UseGuards(CurrentUserGuard)
@Controller("v1/api-keys")
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.apiKeys.list(userId);
  }

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateApiKeyDto) {
    return this.apiKeys.create(userId, dto.name);
  }

  @Delete(":id")
  async revoke(@CurrentUser() userId: string, @Param("id") id: string) {
    await this.apiKeys.revoke(userId, id);
    return { ok: true };
  }
}
