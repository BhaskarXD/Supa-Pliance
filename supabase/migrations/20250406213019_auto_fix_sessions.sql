-- Create the auto_fix_sessions table to store session state for auto-fix operations
CREATE TABLE IF NOT EXISTS public.auto_fix_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID NOT NULL REFERENCES public.compliance_checks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL CHECK (check_type IN ('mfa', 'rls', 'pitr')),
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  config JSONB,
  suggestions JSONB,
  results JSONB,
  
  CONSTRAINT auto_fix_sessions_check_project_unique UNIQUE (check_id, project_id)
);

-- Add RLS policies for auto_fix_sessions
ALTER TABLE public.auto_fix_sessions ENABLE ROW LEVEL SECURITY;

-- Allow users to select their own sessions (via project ownership)
CREATE POLICY "Users can view their own auto-fix sessions"
  ON public.auto_fix_sessions
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- Allow users to insert their own sessions (via project ownership)
CREATE POLICY "Users can create their own auto-fix sessions"
  ON public.auto_fix_sessions
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- Allow users to update their own sessions (via project ownership)
CREATE POLICY "Users can update their own auto-fix sessions"
  ON public.auto_fix_sessions
  FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- Allow users to delete their own sessions (via project ownership)
CREATE POLICY "Users can delete their own auto-fix sessions"
  ON public.auto_fix_sessions
  FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- Add the table to the publication for realtime updates
ALTER PUBLICATION supabase_realtime ADD TABLE auto_fix_sessions;

-- Create an index on check_id for faster lookups
CREATE INDEX auto_fix_sessions_check_id_idx ON public.auto_fix_sessions(check_id);