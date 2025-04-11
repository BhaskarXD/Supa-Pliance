-- Drop the view first as it depends on project_id
DROP VIEW IF EXISTS public.active_auto_fix_sessions;

-- Then drop any indexes on project_id
DROP INDEX IF EXISTS auto_fix_sessions_project_id_idx;

-- Then proceed with constraint removal
DO $$ 
BEGIN
  -- First drop the unique constraint that uses project_id
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'auto_fix_sessions_check_project_unique'
  ) THEN
    ALTER TABLE public.auto_fix_sessions
    DROP CONSTRAINT auto_fix_sessions_check_project_unique;
  END IF;

  -- Next drop the foreign key constraint if it exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'auto_fix_sessions_project_id_fkey'
  ) THEN
    ALTER TABLE public.auto_fix_sessions
    DROP CONSTRAINT auto_fix_sessions_project_id_fkey;
  END IF;
END $$;

-- Drop all policies on auto_fix_sessions table
DO $$
DECLARE
  policy_name text;
BEGIN
  -- Drop any policies on the table
  FOR policy_name IN
    SELECT polname
    FROM pg_policy
    JOIN pg_class ON pg_policy.polrelid = pg_class.oid
    WHERE pg_class.relname = 'auto_fix_sessions'
      AND pg_class.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.auto_fix_sessions', policy_name);
  END LOOP;
END $$;

-- Finally drop the column
ALTER TABLE public.auto_fix_sessions DROP COLUMN project_id;

-- Now recreate the policies using check_id to join to project
CREATE POLICY "Users can view auto-fix sessions via check_id"
  ON public.auto_fix_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.compliance_checks cc
      WHERE cc.id = check_id
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = cc.project_id AND p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert auto-fix sessions via check_id"
  ON public.auto_fix_sessions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.compliance_checks cc
      WHERE cc.id = check_id
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = cc.project_id AND p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update auto-fix sessions via check_id"
  ON public.auto_fix_sessions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.compliance_checks cc
      WHERE cc.id = check_id
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = cc.project_id AND p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete auto-fix sessions via check_id"
  ON public.auto_fix_sessions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.compliance_checks cc
      WHERE cc.id = check_id
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = cc.project_id AND p.user_id = auth.uid()
      )
    )
  );