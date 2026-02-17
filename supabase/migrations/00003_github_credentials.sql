-- Add GitHub credentials to workspaces
alter table workspaces add column github_token text;
alter table workspaces add column github_username text;

-- Add error tracking and file count to codebase_connections
alter table codebase_connections add column error_message text;
alter table codebase_connections add column file_count int default 0;
alter table codebase_connections add column module_count int default 0;

-- Unique constraint for upsert on codebase_modules
create unique index codebase_modules_connection_path_idx
  on codebase_modules (connection_id, file_path);

-- Unique constraint for embedding upsert
create unique index embeddings_source_chunk_idx
  on embeddings (source_id, source_type, chunk_index);
