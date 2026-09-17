import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  // Old links may still carry the internal route prefix. The public workspace
  // host exposes these routes without /app.
  if (value === "/app/editor" || value.startsWith("/app/editor/")) {
    return value.slice("/app".length);
  }
  if (value === "/app/preview" || value.startsWith("/app/preview/")) {
    return value.slice("/app".length);
  }
  return value;
}

function isWorkspacePath(pathname: string) {
  return pathname.startsWith("/editor/") || pathname.startsWith("/preview/");
}

function isPreviewPath(pathname: string) {
  return pathname.startsWith("/preview/");
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = getSafeNextPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  // Workspace pages live on the isolated app host. This also protects the
  // return path when OAuth happens to finish on the marketing/www host.
  const destinationOrigin = isPreviewPath(nextPath)
    ? process.env.NEXT_PUBLIC_MARKETING_URL?.replace(/\/$/, "") || url.origin
    : isWorkspacePath(nextPath)
      ? process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || url.origin
      : url.origin;

  return NextResponse.redirect(new URL(nextPath, destinationOrigin));
}
