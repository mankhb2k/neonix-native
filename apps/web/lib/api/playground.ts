export async function fetchPlaygroundFixture(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, signal ? { signal } : undefined);
  if (!response.ok) throw new Error(`Fixture request failed: ${response.status}`);
  return response.text();
}
