-- Add file upload fields to evidence table
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_type text;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_size integer;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS extracted_text text;
ALTER TABLE evidence ALTER COLUMN content SET DEFAULT '';

-- Create storage bucket for evidence files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence-files',
  'evidence-files',
  false,
  52428800, -- 50MB
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/csv', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Users can upload evidence files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'evidence-files');

CREATE POLICY "Users can view evidence files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'evidence-files');

CREATE POLICY "Users can delete evidence files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'evidence-files');
