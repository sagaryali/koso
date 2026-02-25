-- Evidence clusters: pre-computed thematic groupings of evidence items
create table evidence_clusters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  label text not null,
  summary text not null,
  evidence_ids uuid[] not null default '{}',
  evidence_count int not null default 0,
  representative_embedding vector(1536),
  section_relevance jsonb not null default '{}',
  computed_at timestamptz not null default now()
);

create index idx_evidence_clusters_workspace on evidence_clusters (workspace_id);
create index on evidence_clusters using ivfflat (representative_embedding vector_cosine_ops) with (lists = 20);

create table cluster_computation_log (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  last_computed_at timestamptz not null default now(),
  evidence_count_at_computation int not null default 0,
  status text not null default 'completed' check (status in ('computing', 'completed', 'failed'))
);

alter table evidence_clusters enable row level security;
alter table cluster_computation_log enable row level security;

create policy "Users can view clusters in own workspaces"
  on evidence_clusters for select
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));
create policy "Users can view cluster log in own workspaces"
  on cluster_computation_log for select
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create or replace function match_clusters(
  query_embedding vector(1536),
  match_workspace_id uuid,
  match_limit int default 5,
  match_threshold float default 0.3
)
returns table (
  id uuid, label text, summary text, evidence_ids uuid[],
  evidence_count int, section_relevance jsonb, similarity float
)
language plpgsql as $$
begin
  return query
  select c.id, c.label, c.summary, c.evidence_ids, c.evidence_count,
    c.section_relevance,
    (1 - (c.representative_embedding <=> query_embedding))::float as similarity
  from evidence_clusters c
  where c.workspace_id = match_workspace_id
    and (1 - (c.representative_embedding <=> query_embedding)) > match_threshold
  order by c.representative_embedding <=> query_embedding
  limit match_limit;
end;
$$;
