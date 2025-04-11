-- Add project_id column to compliance_checks
ALTER TABLE "public"."compliance_checks" 
    ADD COLUMN "project_id" uuid NOT NULL;

-- Add foreign key constraint
ALTER TABLE "public"."compliance_checks"
    ADD CONSTRAINT "compliance_checks_project_id_fkey" 
    FOREIGN KEY ("project_id") 
    REFERENCES "public"."projects"("id") 
    ON DELETE CASCADE; 