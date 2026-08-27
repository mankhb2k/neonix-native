export async function bootstrapDevSession(): Promise<boolean> {
  const response = await fetch("/api/dev/auth", { method: "POST" });
  if (!response.ok) return false;
  const body = (await response.json()) as { signedIn?: boolean };
  return body.signedIn === true;
}

