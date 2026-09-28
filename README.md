# Neonix

Neonix is an HTML-to-motion-video compiler: it turns HTML and CSS into a real,
exportable motion video. Users connect Claude to the remote MCP server, create
or update a project, open the web editor, preview the result in the browser,
and export when the project is ready.

The repository is a pnpm monorepo. The active render path is **Protocol V2 →
compiler → runtime → preview/export**. Protocol V1, Pixi-based rendering,
Storybook, and the old render-worker path are retired and must not be added
back to the product flow.

## Product flow

```text
Claude
  │ Remote MCP + OAuth
  ▼
Neonix MCP (/api/mcp)
  │ create_project_html / update_project_html / open_editor
  ▼
Supabase Auth + Postgres (RLS-protected project revisions)
  │
  ▼
Neonix dashboard (www.neonix.video/dashboard)
  │ MotionProtocolV2 → compile → RuntimeProjectV3
  ├── Browser preview (CanvasKit/Skia)
  └── Export jobs (/api/v1/renders → native Skia + FFmpeg on Cloud Run)
```

Claude never receives a service-role key and does not call an AI provider from
Neonix. The MCP host validates the Supabase access token, applies the user's
RLS permissions, and returns a stable project reference plus editor URL. Web
and MCP updates use the project revision number to prevent overwriting a newer
edit.

## Architecture rules

1. **One render meaning.** `MotionProtocolV2` is the only document accepted by
   the render core. It is defined by `@motionvideo/motion-protocol` and must be
   schema-validated before compilation.
2. **Semantic authoring JSON.** Protocol JSON contains layers, assets, timing,
   transforms, effects, and audio intent. It never contains matrices, GPU
   handles, decoded media, DOM nodes, or encoder commands.
3. **One compiler and one runtime.** `motion-compiler` lowers Protocol V2 to
   Runtime IR. `motion-runtime` evaluates visual frames and audio mix plans.
   Preview and export consume that output; they do not reimplement timing,
   transforms, hierarchy, or audio mixing.
4. **Editor state is not project data.** Selection, playhead, undo/redo,
   timeline viewport, and panel state belong to the editor session. Only the
   canonical document and immutable revisions are persisted.
5. **MCP-first automation.** Claude uses the remote MCP tools for project
   operations. There is no direct `/api/ai/generate` product path.
6. **Security at the database boundary.** Supabase Auth identifies users and
   Postgres RLS authorizes workspace, project, revision, asset, and render-job
   access. Service-role credentials remain server-only.

The detailed protocol and renderer contract is documented in
[`ARCHITECHTURE.md`](ARCHITECHTURE.md).

## Monorepo layout

### Applications

| Path | Responsibility |
| --- | --- |
| [`apps/web`](apps/web) | Next.js landing pages, auth, workspace, V2 editor, MCP HTTP endpoint, project BFF, and render-job API. |

### Core packages

| Package | Responsibility |
| --- | --- |
| [`motion-protocol`](packages/motion-protocol) | Strict Protocol V2 schemas, asset/layer vocabulary, and capability ledgers. |
| [`html-compiler`](packages/html-compiler) | HTML/CSS authoring source boundary; lowers a validated HTML/CSS subset into Protocol V2. |
| [`motion-compiler`](packages/motion-compiler) | Validates and lowers Protocol V2 into `RuntimeProjectV3`. |
| [`motion-runtime`](packages/motion-runtime) | Deterministic visual frame evaluation, Matrix4 transforms, paint commands, and audio mix plans. |
| [`editor-core`](packages/editor-core) | Framework-independent document commands, selection, timeline projection, and interaction algorithms. |
| [`editor-runtime`](packages/editor-runtime) | Editor-session compile caching and canonical frame/layer sampling on top of `motion-compiler`/`motion-runtime`. |
| [`canvaskit-preview`](packages/canvaskit-preview) | Replays the runtime's `PaintCommandBuffer` via CanvasKit/Skia for the live browser preview — UI preview only, never the export path. |

### Integration and infrastructure packages

| Package | Responsibility |
| --- | --- |
| [`motion-mcp`](packages/motion-mcp) | Transport-agnostic remote MCP tool contracts and registration. The web app supplies auth and persistence. |
| [`web storage orchestration`](apps/web/lib/server/r2.ts) | Web-owned R2 access, upload/download signing, asset keys, and artifact storage. Postgres stores metadata, not media bytes. |
| [`render-native`](packages/render-native) | Native Skia + FFmpeg renderer — the only production MP4 export path — plus the shared render manifest, job, provider, and preset contracts. |
| [`asset-registry`](packages/asset-registry) | Asset identity, MIME/hash metadata, SVG safety, and font metadata. |
| [`audio-analysis`](packages/audio-analysis) | Audio metadata and analysis helpers. |
| [`playback-engine`](packages/playback-engine) | Browser playback scheduling and WebAudio consumption of Runtime audio plans. |

## Web application boundaries

`apps/web` keeps server routes under [`apps/web/app/api`](apps/web/app/api):

- `/api/auth/callback` — Supabase cookie/PKCE callback.
- `/api/mcp` — authenticated Streamable HTTP MCP endpoint.
- `/api/v1/editor/projects/[projectId]` — Protocol V2 editor read/update BFF with revision checks.
- `/api/v1/projects/[projectId]` — HTML document project resource.
- `/api/v1/renders` and `/api/v1/renders/[id]` — render-job creation/status.
- `/api/oauth/decision` and `/oauth/consent` — MCP OAuth consent surface.

The canonical web editor adapter is [`apps/web/lib/editor`](apps/web/lib/editor).
It translates UI intents into `editor-core` commands and Protocol V2 document
updates. Components call typed clients in `apps/web/lib/api`; they should not
make raw `fetch` calls for project persistence.

## Data and storage model

Supabase owns identity and application metadata:

- `auth.users` is managed by Supabase Auth.
- `public.profiles` stores application account state (`plan`, project limit,
  total storage quota, and per-file upload limit). New accounts default to the
  `free` plan.
- `workspaces` and `workspace_members` provide ownership and roles.
- `projects` and immutable `project_revisions` store the current head and
  canonical Protocol V2 documents.
- `assets`, `asset_variants`, `project_assets`, and `upload_sessions` store
  R2 object metadata and upload state.
- `render_jobs`, `audit_events`, and `object_deletion_jobs` support authorized
  export and storage cleanup.

The current free-plan defaults are five active projects, 2 GiB total R2-backed
asset storage, 1 GiB per project, and 500 MiB per upload. JSON revisions in
Postgres are not counted as object-storage bytes. Quotas are enforced by
database functions/triggers and must also be checked by upload APIs.

Project deletion is soft deletion followed by a purge window and deletion jobs;
the cleanup worker removes R2 objects before their metadata is permanently
purged. See [`supabase/README.md`](supabase/README.md) for setup and migration
verification.

## Local development

Requirements: Node.js 22 (Node 20+ is supported by the packages), pnpm 10, and
the Supabase CLI for database work.

```powershell
pnpm install
# Create apps/web/.env.local yourself — see Environment below; there is no
# committed .env.example template to copy.
pnpm --filter @motionvideo/web dev
```

Open `http://localhost:3000/dashboard`. The production dashboard is
`https://www.neonix.video/dashboard`; the isolated editor and preview workspace is
`https://app.neonix.video`.

### Environment

At minimum, local web development needs:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<sb_publishable_key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-key>
```

Google OAuth client ID/secret are configured in Supabase Authentication →
Providers → Google for a hosted project. Do not put secrets in
`NEXT_PUBLIC_*` variables or commit `.env.local`. R2 variables are optional
until that production integration is enabled. There is no committed
`.env.example`; ask a maintainer for the full variable list.

### Supabase migrations

```powershell
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

Migrations are the source of truth for tables, constraints, triggers, functions,
and RLS. Do not create the application schema manually in the Dashboard.

## Quality checks

```powershell
# Run every workspace lint script
pnpm lint

# Full TypeScript checks
pnpm typecheck

# V2 editor/core certification checks
pnpm typecheck:v2
pnpm validate:v2-boundary
pnpm validate:v2-consumers

# Unit tests
pnpm test

# Web editor tests and browser smoke tests
pnpm --filter @motionvideo/web test:editor
pnpm --filter @motionvideo/web e2e
```

CI runs repository typecheck, V2 checks, web tests/E2E, and protocol schema
freeze. The active workflows live in [`.github/workflows`](.github/workflows).

## Documentation map

- [`ARCHITECHTURE.md`](ARCHITECHTURE.md) — end-to-end protocol, compiler, runtime, preview, export, and audio boundaries. Kept in sync with the code; treat any mismatch as a bug.
- [`docs/guide/audio.md`](docs/guide/audio.md) — Protocol V2 audio model.
- [`docs/guide/billing-free-pay-as-export.md`](docs/guide/billing-free-pay-as-export.md) — billing/quota model.
- [`docs/api-v1.md`](docs/api-v1.md) — HTTP API v1 reference.
- [`apps/web/README.md`](apps/web/README.md) — web/editor-specific boundaries.
- [`packages/editor-core/README.md`](packages/editor-core/README.md) — framework-independent editor contract.

## Contribution rules

- Keep Protocol V2 as the only render-core input; do not add V1 compatibility
  branches or a parallel schema.
- Keep protocol semantics in protocol/compiler/runtime packages and keep DOM,
  browser media, persistence, and renderer device state at the host boundary.
- Any schema or capability change must update its Zod source, generated schema,
  fixtures, documentation, and certification tests together.
- Preserve deterministic revision writes and `expectedRevisionNo` conflict
  checks for web and MCP mutations.
- Keep credentials and service-role access server-only.
