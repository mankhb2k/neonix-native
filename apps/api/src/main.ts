import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import { auth } from "./auth/auth";
import { AppModule } from "./app.module";
import { env } from "./env";
import { mountMcp } from "./mcp/mount-mcp";

async function bootstrap() {
  // bodyParser disabled: Better Auth needs the raw, unparsed request to
  // read/write its own body - mounted directly on the underlying Express
  // instance before express.json() (added back further down) so no
  // body-parsing middleware touches those paths first.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Cross-subdomain session cookies (api.neonix.video <-> app.neonix.video)
  // only reach the browser if the API echoes back a matching CORS origin
  // with credentials allowed - the default Nest/Express behavior sends no
  // Access-Control-Allow-Origin at all, which silently drops the cookie.
  app.enableCors({
    origin: [env.webAppUrl, ...env.additionalTrustedOrigins],
    credentials: true,
  });
  const expressInstance = app.getHttpAdapter().getInstance();
  expressInstance.all("/api/auth/*splat", toNodeHandler(auth));
  // Polar's webhook signature covers the exact raw bytes it sent - mounted
  // before express.json() for this one path, same reasoning as Better Auth
  // above. See billing/webhooks.controller.ts.
  expressInstance.post("/webhooks/polar", express.raw({ type: "application/json" }));
  // The MCP transport reads the raw request stream itself (via
  // @whatwg-node/server's Node-req-to-Fetch-Request bridge) - mounted before
  // express.json() for the same reason as the two mounts above, otherwise
  // the global JSON parser would drain the stream first and every MCP
  // JSON-RPC request would arrive with an empty body.
  mountMcp(app, expressInstance);
  app.use(express.json());

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(env.port);
  console.log(`[api] listening on :${env.port}`);

  // The render-jobs queue consumer (RenderWorkerProcessor, via
  // @nestjs/bullmq) starts automatically as part of RenderJobsModule - no
  // manual call needed here, unlike the pre-Nest hand-rolled worker.
  // Still runs in the same process as the HTTP server (this app is already
  // a persistent container, not a serverless function, so nothing forces
  // the queue consumer into its own service - see project memory).
}

void bootstrap();
