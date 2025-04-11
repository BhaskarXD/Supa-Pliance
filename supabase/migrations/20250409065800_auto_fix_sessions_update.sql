-- Add fix_phase column to auto_fix_sessions table if it doesn't exist
ALTER TABLE auto_fix_sessions 
ADD COLUMN IF NOT EXISTS fix_phase TEXT DEFAULT 'project_level';

-- Add metadata column to auto_fix_sessions table (JSONB type to store flexible data)
ALTER TABLE auto_fix_sessions 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Update existing sessions to have a default fix_phase
UPDATE auto_fix_sessions 
SET fix_phase = 'project_level' 
WHERE fix_phase IS NULL;

-- Create enum for possible fix phases (for documentation purposes)
COMMENT ON COLUMN auto_fix_sessions.fix_phase IS 'Possible values: not_started, project_level, project_level_complete, user_level, complete';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS auto_fix_sessions_fix_phase_idx ON auto_fix_sessions(fix_phase);
CREATE INDEX IF NOT EXISTS auto_fix_sessions_project_check_idx ON auto_fix_sessions(project_id, check_id);

-- Create view for active auto-fix sessions
CREATE OR REPLACE VIEW active_auto_fix_sessions AS
SELECT * FROM auto_fix_sessions
WHERE status = 'in_progress'
ORDER BY updated_at DESC;