import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 320 || !/^\S+@\S+\.\S+$/.test(email)) {
    return null;
  }

  return email;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Please provide a valid email address." }, { status: 400 });
  }

  const email = normalizeEmail(
    typeof body === "object" && body !== null && "email" in body
      ? (body as { email?: unknown }).email
      : undefined,
  );
  if (!email) {
    return NextResponse.json({ message: "Please provide a valid email address." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("api_waitlist_signups").insert({ email });

    if (error?.code === "23505") {
      return NextResponse.json({ message: "This email is already on the list." });
    }
    if (error) {
      return NextResponse.json({ message: "We could not save your email. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ message: "You are on the list. We will let you know when the API is ready." }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "We could not save your email. Please try again." }, { status: 500 });
  }
}
