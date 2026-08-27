import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd(), false);

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = (process.env.DEV_DEMO_EMAIL ?? "demo1@gmail.com").trim().toLowerCase();
  const password = process.env.DEV_DEMO_PASSWORD;

  if (!url || !serviceRoleKey || !password) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and DEV_DEMO_PASSWORD in apps/web/.env",
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: users, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  const existing = users.users.find((user) => user.email?.toLowerCase() === email);
  let userId: string;

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: "Neonix Demo" },
    });
    if (error) throw error;
    userId = existing.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Neonix Demo" },
    });
    if (error || !data.user) throw error ?? new Error("Supabase did not return the demo user");
    userId = data.user.id;
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    display_name: "Neonix Demo",
  });
  if (profileError) throw profileError;

  const { data: workspace, error: workspaceLookupError } = await admin
    .from("workspaces")
    .select("id")
    .eq("created_by", userId)
    .limit(1)
    .maybeSingle();
  if (workspaceLookupError) throw workspaceLookupError;
  if (!workspace) {
    const { error } = await admin.from("workspaces").insert({
      name: "Demo workspace",
      created_by: userId,
    });
    if (error) throw error;
  }

  process.stdout.write(`Demo user ready: ${email}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
