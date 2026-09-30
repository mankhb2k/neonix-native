import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

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
    const response = await fetch(`${API_URL}/v1/waitlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = (await response.json()) as { message?: string; error?: { message?: string } };
    if (!response.ok) {
      return NextResponse.json(
        { message: result.error?.message ?? "We could not save your email. Please try again." },
        { status: response.status },
      );
    }
    return NextResponse.json({ message: result.message }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "We could not save your email. Please try again." }, { status: 500 });
  }
}
