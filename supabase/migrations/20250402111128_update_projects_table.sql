-- Drop the redundant project_ref column since it's in supabase_url
ALTER TABLE projects DROP COLUMN project_ref;

-- Add the new db_connection_string column
ALTER TABLE projects ADD COLUMN db_connection_string text;