import type { MarketSearchResult, MarketResearchResponse } from "@/types";

export async function searchMarket(
  query: string,
  workspaceId: string,
  options?: { maxResults?: number }
): Promise<{ results: MarketSearchResult[]; cached: boolean }> {
  const res = await fetch("/api/market/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      workspaceId,
      maxResults: options?.maxResults ?? 5,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Search failed" }));
    throw new Error(err.error || "Market search failed");
  }

  return res.json();
}

export async function researchFeature(
  featureDescription: string,
  productDomain: string,
  workspaceId: string
): Promise<MarketResearchResponse> {
  const res = await fetch("/api/market/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ featureDescription, productDomain, workspaceId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Research failed" }));
    throw new Error(err.error || "Market research failed");
  }

  return res.json();
}
