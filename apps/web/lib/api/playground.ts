export async function fetchPlaygroundFixture(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fixture request failed: ${response.status}`);
  return response.text();
}
