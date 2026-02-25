-- Add index for multi-repo lookup on codebase_connections
CREATE INDEX IF NOT EXISTS idx_codebase_connections_workspace ON codebase_connections(workspace_id);
