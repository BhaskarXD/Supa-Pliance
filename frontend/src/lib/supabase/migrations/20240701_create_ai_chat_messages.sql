-- Create AI chat messages table
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  context JSONB
);

-- Create a table to track chat sessions
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL,
  check_id UUID,
  check_type VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_id ON public.ai_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_project_id ON public.ai_chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_user_id ON public.ai_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_project_id ON public.ai_chat_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_id ON public.ai_chat_sessions(user_id);

-- Add RLS policies
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies to control access
CREATE POLICY "Users can only access their own chat messages"
  ON public.ai_chat_messages
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can only access their own chat sessions"
  ON public.ai_chat_sessions
  FOR ALL
  USING (user_id = auth.uid());

-- Grant access to authenticated users
GRANT ALL ON public.ai_chat_messages TO authenticated;
GRANT ALL ON public.ai_chat_sessions TO authenticated; 