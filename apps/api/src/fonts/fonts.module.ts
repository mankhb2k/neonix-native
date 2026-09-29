import { Module } from "@nestjs/common";
import { AuthzModule } from "../authz/authz.module";
import { FontsController } from "./fonts.controller";
import { FontsService } from "./fonts.service";

@Module({
  imports: [AuthzModule],
  controllers: [FontsController],
  providers: [FontsService],
})
export class FontsModule {}
