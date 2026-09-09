import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const authorizationId = formData.get("authorization_id");
  const decision = formData.get("decision");

  if (
    typeof authorizationId !== "string" ||
    !authorizationId ||
    (decision !== "approve" && decision !== "deny")
  ) {
    return NextResponse.json({ error: "Invalid OAuth decision" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const result =
    decision === "approve"
      ? await supabase.auth.oauth.approveAuthorization(authorizationId)
      : await supabase.auth.oauth.denyAuthorization(authorizationId);

  if (result.error || !result.data?.redirect_url) {
    return NextResponse.json(
      { error: result.error?.message ?? "OAuth decision failed" },
      { status: 400 },
    );
  }

  // This route is reached by a form POST. A 303 makes the OAuth client follow
  // the callback URL with GET instead of replaying the POST to ChatGPT.
  return NextResponse.redirect(result.data.redirect_url, 303);
}
