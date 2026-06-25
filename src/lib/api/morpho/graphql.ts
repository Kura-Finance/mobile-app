/**
 * Morpho GraphQL client — shared by vault listings and fee-wrapper discovery.
 */
export const MORPHO_GRAPHQL_URL = 'https://api.morpho.org/graphql';
export const MORPHO_BASE_CHAIN_ID = 8453;

export async function morphoQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(MORPHO_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (!res.ok || json.errors?.length) {
    const msg = json.errors?.[0]?.message ?? `Morpho API ${res.status}`;
    throw new Error(msg);
  }
  return json.data as T;
}
