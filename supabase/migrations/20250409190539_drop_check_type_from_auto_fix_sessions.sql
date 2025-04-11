-- First, drop the view that depends on check_type column
DROP VIEW IF EXISTS public.active_auto_fix_sessions;

-- Then proceed with constraint and column removal
DO $$ 
BEGIN
  -- Drop the constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'auto_fix_sessions_check_type_check'
  ) THEN
    ALTER TABLE public.auto_fix_sessions
    DROP CONSTRAINT auto_fix_sessions_check_type_check;
  END IF;
  
  -- Drop the column
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'auto_fix_sessions' AND column_name = 'check_type'
  ) THEN
    ALTER TABLE public.auto_fix_sessions
    DROP COLUMN check_type;
  END IF;
  
  -- Update the auto_fix_sessions_check_id_fkey to cascade delete if not already set
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'auto_fix_sessions_check_id_fkey'
  ) THEN
    -- First drop the existing constraint
    ALTER TABLE public.auto_fix_sessions
    DROP CONSTRAINT IF EXISTS auto_fix_sessions_check_id_fkey;
    
    -- Re-add with CASCADE option
    ALTER TABLE public.auto_fix_sessions
    ADD CONSTRAINT auto_fix_sessions_check_id_fkey
    FOREIGN KEY (check_id)
    REFERENCES public.compliance_checks(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Recreate the view without the check_type column
CREATE OR REPLACE VIEW public.active_auto_fix_sessions AS
SELECT id, check_id, project_id, status, fix_phase, metadata, config, results, suggestions, created_at, updated_at
FROM public.auto_fix_sessions
WHERE status = 'in_progress'
ORDER BY updated_at DESC;