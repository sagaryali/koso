-- RPC function for vector similarity search
create or replace function match_embeddings(
  query_embedding vector(1536),
  match_workspace_id uuid,
  match_source_types text[] default null,
  match_limit int default 10,
  match_threshold float default 0.0
)
returns table (
  id uuid,
  source_id uuid,
  source_type text,
  chunk_text text,
  chunk_index int,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    e.id,
    e.source_id,
    e.source_type,
    e.chunk_text,
    e.chunk_index,
    e.metadata,
    (1 - (e.embedding <=> query_embedding))::float as similarity
  from embeddings e
  where e.workspace_id = match_workspace_id
    and (match_source_types is null or e.source_type = any(match_source_types))
    and (1 - (e.embedding <=> query_embedding)) > match_threshold
  order by e.embedding <=> query_embedding
  limit match_limit;
end;
$$;
