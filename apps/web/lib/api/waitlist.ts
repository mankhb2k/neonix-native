export type WaitlistResponse = {
  message: string;
};

export async function submitApiWaitlist(email: string): Promise<WaitlistResponse> {
  const response = await fetch("/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const result = (await response.json()) as WaitlistResponse;

  if (!response.ok) {
    throw new Error(result.message || "We could not save your email. Please try again.");
  }

  return result;
}
