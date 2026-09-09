import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  getCurrentUser,
} from "@/lib/supabase/server";

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const { authorization_id: authorizationId } = await searchParams;
  if (!authorizationId) {
    return <main>Missing authorization_id.</main>;
  }

  const user = await getCurrentUser();
  if (!user) {
    const nextPath = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: details, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

  if (error || !details) {
    return <main>Invalid or expired OAuth request.</main>;
  }

  if (!("authorization_id" in details)) {
    redirect(details.redirect_url);
  }

  const scopes = details.scope.split(" ").filter(Boolean);

  return (
    <main style={{ maxWidth: 560, margin: "5rem auto", padding: "0 1.5rem" }}>
      <h1>Allow {details.client.name} to connect to Neonix?</h1>
      <p>
        This application will act on your behalf in your current Neonix
        workspace. You can revoke access at any time from your account
        settings.
      </p>
      <p>
        Requesting application: <strong>{details.client.name}</strong>
      </p>
      <p>Requested scopes: {scopes.length ? scopes.join(", ") : "basic access"}</p>
      <form action="/api/oauth/decision" method="post">
        <input type="hidden" name="authorization_id" value={authorizationId} />
        <button type="submit" name="decision" value="approve">
          Allow
        </button>{" "}
        <button type="submit" name="decision" value="deny">
          Deny
        </button>
      </form>
    </main>
  );
}
