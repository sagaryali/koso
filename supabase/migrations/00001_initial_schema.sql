-- Enable vector extension
create extension if not exists vector;

-- Workspaces
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  product_description text,
  principles text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Artifacts (PRDs, user stories, notes, principles)
create table artifacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  type text not null check (type in ('prd', 'user_story', 'principle', 'decision_log', 'roadmap_item', 'architecture_summary')),
  title text not null,
  content jsonb default '{}',
  status text default 'draft' check (status in ('draft', 'active', 'archived')),
  parent_id uuid references artifacts(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Evidence (feedback, metrics, research, meeting notes)
create table evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  type text not null check (type in ('feedback', 'metric', 'research', 'meeting_note')),
  title text not null,
  content text not null,
  source text,
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- Links (relationship graph)
create table links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  source_id uuid not null,
  source_type text not null,
  target_id uuid not null,
  target_type text not null,
  relationship text not null,
  created_at timestamptz default now()
);

-- Embeddings (vector storage)
create table embeddings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  source_id uuid not null,
  source_type text not null,
  chunk_text text not null,
  chunk_index int default 0,
  embedding vector(1536),
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Codebase connections
create table codebase_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  repo_url text not null,
  repo_name text not null,
  default_branch text default 'main',
  last_synced_at timestamptz,
  status text default 'pending' check (status in ('pending', 'syncing', 'ready', 'error'))
);

-- Codebase modules
create table codebase_modules (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references codebase_connections(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete cascade,
  file_path text not null,
  module_name text,
  module_type text check (module_type in ('component', 'service', 'model', 'route', 'utility', 'config', 'test')),
  language text,
  summary text,
  dependencies text[] default '{}',
  exports text[] default '{}',
  embedding vector(1536),
  raw_content text,
  parsed_ast jsonb,
  updated_at timestamptz default now()
);

-- Indexes
create index on embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on codebase_modules using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on artifacts (workspace_id, type);
create index on evidence (workspace_id, type);
create index on links (workspace_id, source_id);
create index on links (workspace_id, target_id);

-- Enable Row Level Security
alter table workspaces enable row level security;
alter table artifacts enable row level security;
alter table evidence enable row level security;
alter table links enable row level security;
alter table embeddings enable row level security;
alter table codebase_connections enable row level security;
alter table codebase_modules enable row level security;

-- RLS Policies: workspaces
create policy "Users can view own workspaces"
  on workspaces for select
  using (auth.uid() = user_id);

create policy "Users can create own workspaces"
  on workspaces for insert
  with check (auth.uid() = user_id);

create policy "Users can update own workspaces"
  on workspaces for update
  using (auth.uid() = user_id);

create policy "Users can delete own workspaces"
  on workspaces for delete
  using (auth.uid() = user_id);

-- RLS Policies: artifacts
create policy "Users can view artifacts in own workspaces"
  on artifacts for select
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can create artifacts in own workspaces"
  on artifacts for insert
  with check (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can update artifacts in own workspaces"
  on artifacts for update
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can delete artifacts in own workspaces"
  on artifacts for delete
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

-- RLS Policies: evidence
create policy "Users can view evidence in own workspaces"
  on evidence for select
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can create evidence in own workspaces"
  on evidence for insert
  with check (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can update evidence in own workspaces"
  on evidence for update
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can delete evidence in own workspaces"
  on evidence for delete
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

-- RLS Policies: links
create policy "Users can view links in own workspaces"
  on links for select
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can create links in own workspaces"
  on links for insert
  with check (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can delete links in own workspaces"
  on links for delete
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

-- RLS Policies: embeddings
create policy "Users can view embeddings in own workspaces"
  on embeddings for select
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can create embeddings in own workspaces"
  on embeddings for insert
  with check (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can delete embeddings in own workspaces"
  on embeddings for delete
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

-- RLS Policies: codebase_connections
create policy "Users can view codebase connections in own workspaces"
  on codebase_connections for select
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can create codebase connections in own workspaces"
  on codebase_connections for insert
  with check (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can update codebase connections in own workspaces"
  on codebase_connections for update
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can delete codebase connections in own workspaces"
  on codebase_connections for delete
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

-- RLS Policies: codebase_modules
create policy "Users can view codebase modules in own workspaces"
  on codebase_modules for select
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can create codebase modules in own workspaces"
  on codebase_modules for insert
  with check (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can update codebase modules in own workspaces"
  on codebase_modules for update
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));

create policy "Users can delete codebase modules in own workspaces"
  on codebase_modules for delete
  using (workspace_id in (select id from workspaces where user_id = auth.uid()));
