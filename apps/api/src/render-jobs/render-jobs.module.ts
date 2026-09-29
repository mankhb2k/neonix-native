import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AuthzModule } from "../authz/authz.module";
import { RenderJobsController } from "./render-jobs.controller";
import { RenderJobsService } from "./render-jobs.service";

// Deliberately does NOT include RenderWorkerProcessor (see
// render-worker.module.ts) - a route-only testing module that imports just
// this must not also start the real worker (which would call the real,
// billed Cloud Run endpoint). The real app wires both modules together in
// AppModule.
@Module({
  imports: [AuthzModule, BullModule.registerQueue({ name: "render-jobs" })],
  controllers: [RenderJobsController],
  providers: [RenderJobsService],
})
export class RenderJobsModule {}
