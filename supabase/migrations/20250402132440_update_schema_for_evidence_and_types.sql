-- Add metadata column to evidence table
ALTER TABLE "public"."evidence" 
    ADD COLUMN IF NOT EXISTS "metadata" jsonb;

-- Update table_info type definition
DO $$ BEGIN
    CREATE TYPE "public"."table_info" AS (
        table_name text,
        has_rls boolean,
        force_rls boolean,
        description text
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update pg_setting type definition
DO $$ BEGIN
    CREATE TYPE "public"."pg_setting" AS (
        name text,
        setting text,
        unit text,
        context text,
        category text
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add comment to explain the metadata column
COMMENT ON COLUMN "public"."evidence"."metadata" IS 'JSON object containing additional evidence details like request/response data';
