import type { IssueLinkOutput } from '@contracts';

type Fetch = typeof fetch;

/** Calls Profile's internal endpoint; Hatchet retries this step on failures. */
export async function issueProfileLink(
  personId: string,
  fetcher: Fetch = fetch,
  profileOrigin = process.env.PROFILE_INTERNAL_URL ?? 'http://localhost:3002',
): Promise<IssueLinkOutput> {
  const response = await fetcher(`${profileOrigin}/api/v1/internal/links`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ personId }),
  });

  if (!response.ok) throw new Error(`Profile API rejected link issuance: ${response.status}`);
  return response.json() as Promise<IssueLinkOutput>;
}
