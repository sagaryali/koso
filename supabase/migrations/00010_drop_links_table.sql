-- Drop the links table and all associated objects
-- Evidence linking is being replaced by clusters

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can view links in their workspace" ON links;
DROP POLICY IF EXISTS "Users can create links in their workspace" ON links;
DROP POLICY IF EXISTS "Users can delete links in their workspace" ON links;

-- Drop indexes
DROP INDEX IF EXISTS idx_links_workspace_source;
DROP INDEX IF EXISTS idx_links_workspace_target;

-- Drop the table
DROP TABLE IF EXISTS links;
