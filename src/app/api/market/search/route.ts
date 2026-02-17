import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MOCK_MARKET_RESULTS } from "../../../../../scripts/seed-data/mock-responses";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

function isDemoMode() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
const CACHE_TTL_HOURS = 24;
const RATE_LIMIT_MAX = 10; // per minute per workspace
const RATE_LIMIT_WINDOW_MS = 60_000;

// In-memory rate limit tracker (resets on server restart — fine for single-instance)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(workspaceId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(workspaceId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(workspaceId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;

  entry.count++;
  return true;
}

function hashQuery(query: string): string {
  // Simple hash for cache key — normalized lowercase trimmed
  const normalized = query.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
  }
  return String(hash);
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "unknown";
  }
}

interface TavilyResult {
  title: string;
  content: string;
  url: string;
}

export async function POST(request: NextRequest) {
  try {
    // Demo mode: return canned market results
    if (isDemoMode()) {
      return Response.json({
        results: MOCK_MARKET_RESULTS.slice(0, 5),
        cached: false,
      });
    }

    if (!TAVILY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Market search not configured (missing TAVILY_API_KEY)" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const { query, workspaceId, maxResults = 5 } = await request.json();

    if (!query || !workspaceId) {
      return new Response(
        JSON.stringify({ error: "query and workspaceId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Rate limit check
    if (!checkRateLimit(workspaceId)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Max 10 searches per minute." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createAdminClient();
    const queryHash = hashQuery(query);

    // Check Supabase cache
    const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
    const { data: cached } = await supabase
      .from("market_research_cache")
      .select("results_json")
      .eq("workspace_id", workspaceId)
      .eq("query_hash", queryHash)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (cached) {
      return Response.json({ results: cached.results_json, cached: true });
    }

    // Call Tavily API
    const tavilyRes = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        max_results: Math.min(maxResults, 10),
        search_depth: "basic",
        include_answer: false,
      }),
    });

    if (!tavilyRes.ok) {
      const err = await tavilyRes.text().catch(() => "Tavily request failed");
      console.error("[market/search] Tavily error:", err);
      return new Response(
        JSON.stringify({ error: "Market search failed" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const tavilyData = await tavilyRes.json();
    const results = (tavilyData.results || []).map((r: TavilyResult) => ({
      title: r.title,
      snippet: r.content?.slice(0, 300) || "",
      url: r.url,
      source: extractDomain(r.url),
    }));

    // Cache results in Supabase (fire-and-forget)
    Promise.resolve(
      supabase
        .from("market_research_cache")
        .insert({
          workspace_id: workspaceId,
          query_hash: queryHash,
          query_text: query,
          results_json: results,
        })
    ).catch((err: unknown) => console.error("[market/search] Cache write failed:", err));

    return Response.json({ results, cached: false });
  } catch (err) {
    console.error("[market/search] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
