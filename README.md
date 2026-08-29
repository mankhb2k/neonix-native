# Neonix

Neonix is an AI-first motion-video editor. Users connect Claude to the remote
MCP server, create or update a project, open the web editor, preview the result
in the browser, and export when the project is ready.

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
  │ create_project / update_project / open_editor
  ▼
Supabase Auth + Postgres (RLS-protected project revisions)
  │
  ▼
Neonix dashboard (neonix.video/dashboard)
  │ MotionProtocolV2 → compile → RuntimeFrameV2
  ├── Native browser preview (WebGPU, WebGL2 fallback)
  └── Export jobs (/api/renders → Remotion/Lambda when configured)
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
[`docs/guide/v2-architechture.md`](docs/guide/v2-architechture.md).

## Monorepo layout

### Applications

| Path | Responsibility |
| --- | --- |
| [`apps/web`](apps/web) | Next.js landing pages, auth, workspace, V2 editor, MCP HTTP endpoint, project BFF, and render-job API. |
| [`apps/remotion-site`](apps/remotion-site) | Remotion composition used for smoke tests and preview/export parity checks. |

### Core packages

| Package | Responsibility |
| --- | --- |
| [`motion-protocol`](packages/motion-protocol) | Strict Protocol V2 schemas, asset/layer vocabulary, and capability ledgers. |
| [`motion-compiler`](packages/motion-compiler) | Validates and lowers Protocol V2 into Runtime V2 IR. |
| [`motion-runtime`](packages/motion-runtime) | Deterministic visual frame evaluation, Matrix4 transforms, paint commands, and audio mix plans. |
| [`editor-core`](packages/editor-core) | Framework-independent document commands, selection, timeline projection, and interaction algorithms. |
| [`preview-renderer`](packages/preview-renderer) | Native WebGPU-first/WebGL2-fallback painter for evaluated runtime frames. |
| [`remotion-renderer`](packages/remotion-renderer) | Remotion painter and audio track for the same runtime output used by preview. |

### Integration and infrastructure packages

| Package | Responsibility |
| --- | --- |
| [`motion-mcp`](packages/motion-mcp) | Transport-agnostic remote MCP tool contracts and registration. The web app supplies auth and persistence. |
| [`motion-storage`](packages/motion-storage) | Storage abstraction for memory or R2/S3-compatible object storage. Postgres stores metadata, not media bytes. |
| [`export-renderer`](packages/export-renderer) | Native VPS renderer plus the shared render manifest, job, provider, preset, and worker contracts. |
| [`asset-registry`](packages/asset-registry) | Asset identity, MIME/hash metadata, SVG safety, and font metadata. |
| [`audio-analysis`](packages/audio-analysis) | Audio metadata and analysis helpers. |
| [`playback-engine`](packages/playback-engine) | Browser playback scheduling and WebAudio consumption of Runtime V2 audio plans. |
| [`patterns`](packages/patterns) | Reusable Protocol V2 fixture/pattern data; it is not a second document format. |

## Web application boundaries

`apps/web` keeps server routes under [`apps/web/app/api`](apps/web/app/api):

- `/api/auth/callback` — Supabase cookie/PKCE callback.
- `/api/mcp` — authenticated Streamable HTTP MCP endpoint.
- `/api/projects/[projectId]` — project read/update BFF with revision checks.
- `/api/renders` and `/api/renders/[id]` — render-job creation/status.
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
Copy-Item .env.example .env.local
pnpm --filter @motionvideo/web dev
```

Open `http://localhost:3000/dashboard`. The production dashboard is
`https://neonix.video/dashboard`; the isolated editor and preview workspace is
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
`NEXT_PUBLIC_*` variables or commit `.env.local`. R2 and Remotion/Lambda
variables are optional until those production integrations are enabled; the
complete template is [`.env.example`](.env.example).

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
pnpm validate:v2-hard-lock
pnpm validate:v2-runtime-boundary
pnpm validate:v2-consumers
pnpm validate:v2-renderers
pnpm validate:v2-core

# Unit tests
pnpm test

# Web editor tests and browser smoke tests
pnpm --filter @motionvideo/web test:editor
pnpm --filter @motionvideo/web e2e
```

CI runs repository typecheck, V2 checks, web tests/E2E, protocol schema freeze,
and Remotion smoke/parity tests. The active workflows live in
[`.github/workflows`](.github/workflows).

## Documentation map

- [`docs/guide/README.md`](docs/guide/README.md) — active V2 guide entrypoint.
- [`docs/guide/v2-architechture.md`](docs/guide/v2-architechture.md) — end-to-end protocol, compiler, runtime, preview, export, and audio boundaries.
- [`docs/guide/audio.md`](docs/guide/audio.md) — Protocol V2 audio model.
- [`docs/atomic-protocol-v2-preview-e2e-plan.md`](docs/atomic-protocol-v2-preview-e2e-plan.md) — certified atom and parity gates.
- [`docs/plans/mcp-google-oauth-implementation-plan.md`](docs/plans/mcp-google-oauth-implementation-plan.md) — OAuth, MCP, RLS, and export rollout plan.
- [`docs/web/authoring-json-shape.md`](docs/web/authoring-json-shape.md) — web editor document shape examples.
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

See [`LICENSE`](LICENSE) for licensing information.
