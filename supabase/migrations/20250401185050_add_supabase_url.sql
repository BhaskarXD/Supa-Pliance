-- Add supabase_url column to projects table
ALTER TABLE "public"."projects" 
    ADD COLUMN IF NOT EXISTS "supabase_url" TEXT NOT NULL DEFAULT 'https://supabase.co'; 