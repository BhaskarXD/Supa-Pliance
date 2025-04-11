-- Create scans table
CREATE TABLE IF NOT EXISTS public.scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES public.projects(id) NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'running',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  summary JSONB
);

-- Add scan_id to compliance_checks
ALTER TABLE public.compliance_checks 
ADD COLUMN scan_id UUID REFERENCES public.scans(id);

-- Create index for faster lookups
CREATE INDEX compliance_checks_scan_id_idx ON public.compliance_checks(scan_id);
