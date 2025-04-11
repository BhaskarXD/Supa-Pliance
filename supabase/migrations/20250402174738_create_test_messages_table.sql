-- Create test messages table for real-time testing
CREATE TABLE IF NOT EXISTS test_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE test_messages ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all operations (for testing purposes)
CREATE POLICY "Allow all operations" 
ON test_messages 
FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);