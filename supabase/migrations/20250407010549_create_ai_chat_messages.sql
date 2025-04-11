-- Create AI chat messages table
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  context JSONB
);

-- Create a table to track chat sessions
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  check_id UUID,
  check_type VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

-- Add foreign key references
ALTER TABLE public.ai_chat_messages
  ADD CONSTRAINT ai_chat_messages_session_id_fkey
  FOREIGN KEY (session_id)
  REFERENCES public.ai_chat_sessions(id)
  ON DELETE CASCADE;

ALTER TABLE public.ai_chat_sessions
  ADD CONSTRAINT ai_chat_sessions_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES public.projects(id)
  ON DELETE CASCADE;

ALTER TABLE public.ai_chat_sessions
  ADD CONSTRAINT ai_chat_sessions_check_id_fkey
  FOREIGN KEY (check_id)
  REFERENCES public.compliance_checks(id)
  ON DELETE SET NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_id ON public.ai_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_project_id ON public.ai_chat_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_check_id ON public.ai_chat_sessions(check_id);

-- Add RLS policies
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if running migration again)
DROP POLICY IF EXISTS "Users can select their own chat messages" ON public.ai_chat_messages;
DROP POLICY IF EXISTS "Users can insert their own chat messages" ON public.ai_chat_messages;
DROP POLICY IF EXISTS "Users can update their own chat messages content only" ON public.ai_chat_messages;
DROP POLICY IF EXISTS "Users can delete their own chat messages" ON public.ai_chat_messages;
DROP POLICY IF EXISTS "Users can select their projects' chat messages" ON public.ai_chat_messages;
DROP POLICY IF EXISTS "Users can insert messages for their projects" ON public.ai_chat_messages;
DROP POLICY IF EXISTS "Users can update messages for their projects" ON public.ai_chat_messages;
DROP POLICY IF EXISTS "Users can delete messages for their projects" ON public.ai_chat_messages;
DROP POLICY IF EXISTS "Users can select their own chat sessions" ON public.ai_chat_sessions;
DROP POLICY IF EXISTS "Users can insert their own chat sessions" ON public.ai_chat_sessions;
DROP POLICY IF EXISTS "Users can update their own chat sessions" ON public.ai_chat_sessions;
DROP POLICY IF EXISTS "Users can delete their own chat sessions" ON public.ai_chat_sessions;
DROP POLICY IF EXISTS "Users can select their projects' chat sessions" ON public.ai_chat_sessions;
DROP POLICY IF EXISTS "Users can insert sessions for their projects" ON public.ai_chat_sessions;
DROP POLICY IF EXISTS "Users can update sessions for their projects" ON public.ai_chat_sessions;
DROP POLICY IF EXISTS "Users can delete sessions for their projects" ON public.ai_chat_sessions;

-- Create policies for ai_chat_messages based on session ownership
CREATE POLICY "Users can select messages for their projects"
  ON public.ai_chat_messages
  FOR SELECT
  USING (
    session_id IN (
      SELECT s.id FROM public.ai_chat_sessions s
      JOIN public.projects p ON s.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages for their projects"
  ON public.ai_chat_messages
  FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT s.id FROM public.ai_chat_sessions s
      JOIN public.projects p ON s.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages for their projects"
  ON public.ai_chat_messages
  FOR UPDATE
  USING (
    session_id IN (
      SELECT s.id FROM public.ai_chat_sessions s
      JOIN public.projects p ON s.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages for their projects"
  ON public.ai_chat_messages
  FOR DELETE
  USING (
    session_id IN (
      SELECT s.id FROM public.ai_chat_sessions s
      JOIN public.projects p ON s.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Create policies for ai_chat_sessions based on project ownership
CREATE POLICY "Users can select their projects' chat sessions"
  ON public.ai_chat_sessions
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert sessions for their projects"
  ON public.ai_chat_sessions
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sessions for their projects"
  ON public.ai_chat_sessions
  FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete sessions for their projects"
  ON public.ai_chat_sessions
  FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- Grant access to authenticated users
GRANT ALL ON public.ai_chat_messages TO authenticated;
GRANT ALL ON public.ai_chat_sessions TO authenticated;