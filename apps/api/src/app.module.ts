import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AssetsModule } from "./assets/assets.module";
import { AuditEventsModule } from "./audit-events/audit-events.module";
import { BillingModule } from "./billing/billing.module";
import { DatabaseModule } from "./db/database.module";
import { env } from "./env";
import { FontsModule } from "./fonts/fonts.module";
import { ProjectsModule } from "./projects/projects.module";
import { RenderJobsModule } from "./render-jobs/render-jobs.module";
import { RenderWorkerModule } from "./render-jobs/render-worker.module";
import { WorkspacesModule } from "./workspaces/workspaces.module";

@Module({
  imports: [
    BullModule.forRoot({ connection: { url: env.redisUrl, maxRetriesPerRequest: null } }),
    DatabaseModule,
    WorkspacesModule,
    ProjectsModule,
    AssetsModule,
    FontsModule,
    RenderJobsModule,
    RenderWorkerModule,
    AuditEventsModule,
    BillingModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
