-- Code Impact Report storage for artifacts
-- Stores AI-generated engineering assessments (module impact, effort, risks, build phases)

create table artifact_code_impact (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references artifacts(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  report jsonb not null default '{}',
  source_type text not null default 'manual' check (source_type in ('manual', 'evidence_flow')),
  generated_at timestamptz not null default now(),
  spec_content_hash int not null default 0,
  source_cluster_ids uuid[] not null default '{}',
  evidence_ids uuid[] not null default '{}',
  unique(artifact_id)
);

create index idx_aci_artifact on artifact_code_impact (artifact_id);
create index idx_aci_workspace on artifact_code_impact (workspace_id);

-- RLS
alter table artifact_code_impact enable row level security;

create policy "Users can view code impact reports in own workspaces"
  on artifact_code_impact for select
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can create code impact reports in own workspaces"
  on artifact_code_impact for insert
  with check (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can update code impact reports in own workspaces"
  on artifact_code_impact for update
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can delete code impact reports in own workspaces"
  on artifact_code_impact for delete
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));
