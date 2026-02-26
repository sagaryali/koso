-- Add criticality scoring to evidence clusters
alter table evidence_clusters
  add column criticality_score float,
  add column criticality_level text check (criticality_level in ('critical', 'high', 'medium', 'low')),
  add column criticality_reason text;

create index idx_evidence_clusters_criticality
  on evidence_clusters (workspace_id, criticality_level);
