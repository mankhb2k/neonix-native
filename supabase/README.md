# Supabase setup

Phase 0–1 uses Supabase Auth/Postgres only. R2 and Remotion Lambda are deliberately not required yet.

## Local application

1. Copy the root environment template:

   ```powershell
   Copy-Item .env.example .env.local
   ```

2. Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, and `MCP_AUDIT_SALT`.

3. Run the web app:

   ```powershell
   pnpm.cmd --filter @motionvideo/web dev
   ```

The Google login page is `/login`; the OAuth consent page is `/oauth/consent`.

## Hosted Supabase Dashboard

For project `neonix.video`/MotiClip configure:

For Google login, paste the Web client ID and client secret from Google Cloud
project `Neonix` into the Supabase Google provider form. The local CLI variable
names are `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and
`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET`; hosted Supabase reads these
values from the Dashboard instead.

- Authentication → Providers → Email: enable email/password sign-in. Decide
  whether email confirmation is required; the UI supports both modes.
- Authentication → Providers → Google: enable the provider.
- Authentication → URL Configuration → Site URL: `https://neonix.video`.
- Redirect allow-list:
  - `https://neonix.video/api/auth/callback`
  - `https://neonix.video/oauth/consent`
  - `https://app.neonix.video/api/auth/callback`
  - `http://localhost:3000/api/auth/callback`
  - `http://localhost:3000/oauth/consent`
- Google OAuth redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
- Authentication → OAuth Server: enable OAuth 2.1 and set authorization path to
  `/oauth/consent`.
- Enable asymmetric JWT signing (RS256 or ES256) before exposing OAuth tokens to
  a third-party MCP client.

## Apply the migration

Install the Supabase CLI, authenticate, then link this repository to the hosted
project. Use the project ref from the Supabase dashboard:

```powershell
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

The migrations create profiles, workspaces, projects, immutable source
revisions, R2 asset metadata, project-to-asset links, system font catalog,
upload sessions, deletion jobs, and RLS policies. They do not create R2
objects or invoke Lambda.

The V2 editor reads and autosaves through the server-only project repository:
`GET/PATCH /api/projects/:projectId`. The repository validates every document
with `MotionProtocolV2Schema`, writes immutable `project_revisions`, and uses
the expected revision number to reject concurrent writes with HTTP 409.

## Verify Phase 2 database + MCP

After `supabase db push`, connect the Neonix MCP endpoint and run these tools
with an authenticated user:

1. `create_project` with a small JSON `document`.
2. `get_project` for the returned `project_id`; verify the latest revision has
   `source_schema_version`, `reason: "mcp"`, and `byte_size`.
3. `update_project` with `expected_revision_no: 1`; verify the next revision
   and `last_activity_at` advance.
4. Sign in as another user and verify `get_project` returns no project.

Project deletion uses `request_project_deletion(project_id)`, which marks the
project deleted and schedules a seven-day purge window. A trusted scheduled
worker must later create and process `object_deletion_jobs` to remove R2
objects before their asset metadata is permanently removed.

## Verify Phase 1

- Sign in at `/login` with Google.
- Confirm a row exists in `public.profiles` for the new `auth.users` record.
- Insert a workspace and confirm the owner membership is created by the trigger.
- Test that a second user cannot select the first user's workspace/project.
- Keep the service-role key server-only; never place it in a browser or MCP
  response.
