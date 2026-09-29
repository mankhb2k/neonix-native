import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { CloudRunModule } from "../cloud-run/cloud-run.module";
import { RenderWorkerProcessor } from "./render-worker.processor";

// The actual BullMQ consumer, split from RenderJobsModule (routes) so a
// route-only test can import that module alone without also starting this
// worker - see render-jobs.module.ts's comment.
@Module({
  imports: [CloudRunModule, BullModule.registerQueue({ name: "render-jobs" })],
  providers: [RenderWorkerProcessor],
})
export class RenderWorkerModule {}
