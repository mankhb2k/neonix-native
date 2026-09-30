import { Module } from "@nestjs/common";
import { RateLimitModule } from "../rate-limit/rate-limit.module";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";

@Module({
  imports: [RateLimitModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
