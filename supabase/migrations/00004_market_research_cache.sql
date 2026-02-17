-- Market research cache table
-- Caches web search results for 24 hours to reduce API calls and improve latency

create table if not exists market_research_cache (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  query_hash text not null,
  query_text text not null,
  results_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Index for fast lookups by workspace + query hash
create index idx_market_cache_lookup
  on market_research_cache (workspace_id, query_hash);

-- Index for TTL cleanup
create index idx_market_cache_created
  on market_research_cache (created_at);

-- Enable RLS
alter table market_research_cache enable row level security;

-- Users can read/write their own workspace's cache
create policy "Users can manage their workspace market cache"
  on market_research_cache
  for all
  using (
    workspace_id in (
      select id from workspaces where user_id = auth.uid()
    )
  );
