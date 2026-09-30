import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AccountModule } from "./account/account.module";
import { AppController } from "./app.controller";
import { AssetsModule } from "./assets/assets.module";
import { AuditEventsModule } from "./audit-events/audit-events.module";
import { BillingModule } from "./billing/billing.module";
import { DatabaseModule } from "./db/database.module";
import { DocumentsModule } from "./documents/documents.module";
import { env } from "./env";
import { FontsModule } from "./fonts/fonts.module";
import { ProfileModule } from "./profile/profile.module";
import { ProjectsModule } from "./projects/projects.module";
import { RenderJobsModule } from "./render-jobs/render-jobs.module";
import { RenderWorkerModule } from "./render-jobs/render-worker.module";
import { SystemCatalogModule } from "./system-catalog/system-catalog.module";
import { WaitlistModule } from "./waitlist/waitlist.module";
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
    WaitlistModule,
    ProfileModule,
    SystemCatalogModule,
    AccountModule,
    DocumentsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
