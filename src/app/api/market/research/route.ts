import { NextRequest } from "next/server";
import type { MarketSearchResult } from "@/types";

/**
 * Runs 2-3 targeted market searches and returns categorized results.
 * Deduplicates by URL across all queries.
 */
export async function POST(request: NextRequest) {
  try {
    const { featureDescription, productDomain, workspaceId } = await request.json();

    if (!featureDescription || !workspaceId) {
      return new Response(
        JSON.stringify({ error: "featureDescription and workspaceId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const domain = productDomain || "";
    const feature = featureDescription.slice(0, 150);

    // Run 3 targeted searches in parallel
    const queries = [
      { query: `${domain} ${feature} competitor`.trim(), category: "competitors" as const },
      { query: `${feature} best practices UX design`, category: "bestPractices" as const },
      { query: `${feature} market demand trends ${new Date().getFullYear()}`, category: "trends" as const },
    ];

    const origin = request.nextUrl.origin;
    const searchResults = await Promise.allSettled(
      queries.map(async ({ query }) => {
        const res = await fetch(`${origin}/api/market/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, workspaceId, maxResults: 5 }),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.results || []) as MarketSearchResult[];
      })
    );

    // Deduplicate by URL across all results
    const seen = new Set<string>();
    function dedup(results: MarketSearchResult[]): MarketSearchResult[] {
      return results.filter((r) => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });
    }

    const competitors = dedup(
      searchResults[0].status === "fulfilled" ? searchResults[0].value : []
    );
    const bestPractices = dedup(
      searchResults[1].status === "fulfilled" ? searchResults[1].value : []
    );
    const trends = dedup(
      searchResults[2].status === "fulfilled" ? searchResults[2].value : []
    );

    return Response.json({ competitors, bestPractices, trends });
  } catch (err) {
    console.error("[market/research] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
