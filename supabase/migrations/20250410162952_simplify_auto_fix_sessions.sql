-- Migration to simplify auto_fix_sessions table
-- First rename the results column to result for clarity
ALTER TABLE auto_fix_sessions 
  RENAME COLUMN results TO result;

-- Update the status enum values for a simpler workflow
UPDATE auto_fix_sessions
  SET status = CASE 
    WHEN status = 'created' THEN 'not_started'
    WHEN status = 'in_progress' THEN 'fixing' 
    WHEN status = 'completed' THEN 'fixed'
    ELSE status
  END;

-- Drop unnecessary columns
ALTER TABLE auto_fix_sessions
  DROP COLUMN fix_phase,
  DROP COLUMN suggestions,
  DROP COLUMN metadata;

-- Drop existing constraint first
ALTER TABLE auto_fix_sessions
  DROP CONSTRAINT IF EXISTS auto_fix_sessions_status_check;

-- Add constraints to ensure only valid status values
ALTER TABLE auto_fix_sessions
  ADD CONSTRAINT auto_fix_sessions_status_check 
  CHECK (status IN ('not_started', 'in_progress', 'fixed', 'failed'));

-- Create an index to improve query performance when looking up by check_id
CREATE INDEX IF NOT EXISTS idx_auto_fix_sessions_check_id 
  ON auto_fix_sessions(check_id);

-- Add a comment describing the simplified table
COMMENT ON TABLE auto_fix_sessions IS 'Tracks auto-fix operations with simplified workflow: not_started → in_progress → fixed/failed';