-- Insights overhaul: PM war-room columns on clusters + artifact linkage

-- New columns on evidence_clusters for verdict, notes, and triage
alter table evidence_clusters
  add column verdict text check (verdict in ('BUILD', 'MAYBE', 'SKIP')),
  add column verdict_reasoning text,
  add column verdict_at timestamptz,
  add column pm_note text,
  add column pinned boolean not null default false,
  add column dismissed boolean not null default false,
  add column custom_label text;

-- Track which clusters sourced an artifact
alter table artifacts
  add column source_cluster_ids uuid[] not null default '{}';

create index idx_artifacts_source_clusters on artifacts using gin (source_cluster_ids);

-- RLS: allow full CRUD for cluster owners (SELECT already exists from 00005)
create policy "Users can insert clusters in own workspaces"
  on evidence_clusters for insert
  with check (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can update clusters in own workspaces"
  on evidence_clusters for update
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can delete clusters in own workspaces"
  on evidence_clusters for delete
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));
