import { redirect } from "next/navigation";
import { Approve } from "@/components/auth/Approve";
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
    <Approve
      authorizationId={authorizationId}
      clientName={details.client.name}
      scopes={scopes}
      returnLabel="You will be returned to ChatGPT after choosing an option."
    />
  );
}
