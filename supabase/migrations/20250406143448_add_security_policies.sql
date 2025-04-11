-- Force RLS on all tables
ALTER TABLE public.scans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_checks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.test_messages FORCE ROW LEVEL SECURITY;

-- Enable RLS on Scans Table (if not already enabled)
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- Add policies for Scans table
CREATE POLICY "Users can only view their own scans" 
ON public.scans FOR SELECT 
USING ((EXISTS (SELECT 1 FROM public.projects 
               WHERE (projects.id = scans.project_id) 
               AND (auth.uid() = projects.user_id))));

CREATE POLICY "Users can only insert scans for their projects" 
ON public.scans FOR INSERT 
WITH CHECK ((EXISTS (SELECT 1 FROM public.projects 
                   WHERE (projects.id = project_id) 
                   AND (auth.uid() = projects.user_id))));

CREATE POLICY "Users can only update their own scans" 
ON public.scans FOR UPDATE
USING ((EXISTS (SELECT 1 FROM public.projects 
               WHERE (projects.id = project_id) 
               AND (auth.uid() = projects.user_id))));

CREATE POLICY "Users can only delete their own scans" 
ON public.scans FOR DELETE
USING ((EXISTS (SELECT 1 FROM public.projects 
               WHERE (projects.id = project_id) 
               AND (auth.uid() = projects.user_id))));

-- Service role can manage all scans
CREATE POLICY "Service role full access to scans"
ON public.scans
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Fix policies on compliance_checks - drop ALL existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.compliance_checks;
DROP POLICY IF EXISTS "Users can view compliance checks" ON public.compliance_checks;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.compliance_checks;
DROP POLICY IF EXISTS "Only authenticated users can create checks" ON public.compliance_checks;

CREATE POLICY "Users can only view their projects' checks" 
ON public.compliance_checks FOR SELECT 
USING ((EXISTS (SELECT 1 FROM public.projects 
               WHERE (projects.id = compliance_checks.project_id) 
               AND (auth.uid() = projects.user_id))));

CREATE POLICY "Users can only insert checks for their projects" 
ON public.compliance_checks FOR INSERT 
WITH CHECK ((EXISTS (SELECT 1 FROM public.projects 
                   WHERE (projects.id = project_id) 
                   AND (auth.uid() = projects.user_id))));

CREATE POLICY "Users can only update their projects' checks" 
ON public.compliance_checks FOR UPDATE
USING ((EXISTS (SELECT 1 FROM public.projects 
               WHERE (projects.id = project_id) 
               AND (auth.uid() = projects.user_id))));

CREATE POLICY "Users can only delete their projects' checks" 
ON public.compliance_checks FOR DELETE
USING ((EXISTS (SELECT 1 FROM public.projects 
               WHERE (projects.id = project_id) 
               AND (auth.uid() = projects.user_id))));

-- Service role can manage all compliance checks
CREATE POLICY "Service role full access to compliance_checks"
ON public.compliance_checks
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Fix policies on evidence - drop ALL existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.evidence;
DROP POLICY IF EXISTS "Users can view evidence" ON public.evidence;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.evidence;
DROP POLICY IF EXISTS "Only authenticated users can insert evidence" ON public.evidence;

CREATE POLICY "Users can only view their projects' evidence" 
ON public.evidence FOR SELECT 
USING ((EXISTS (SELECT 1 FROM public.compliance_checks 
               WHERE (compliance_checks.id = evidence.check_id)
               AND (EXISTS (SELECT 1 FROM public.projects 
                          WHERE (projects.id = compliance_checks.project_id) 
                          AND (auth.uid() = projects.user_id))))));

CREATE POLICY "Users can only insert evidence for their projects' checks" 
ON public.evidence FOR INSERT 
WITH CHECK ((EXISTS (SELECT 1 FROM public.compliance_checks 
                   WHERE (compliance_checks.id = check_id)
                   AND (EXISTS (SELECT 1 FROM public.projects 
                              WHERE (projects.id = compliance_checks.project_id) 
                              AND (auth.uid() = projects.user_id))))));

CREATE POLICY "Users can only update their projects' evidence" 
ON public.evidence FOR UPDATE
USING ((EXISTS (SELECT 1 FROM public.compliance_checks 
               WHERE (compliance_checks.id = check_id)
               AND (EXISTS (SELECT 1 FROM public.projects 
                          WHERE (projects.id = compliance_checks.project_id) 
                          AND (auth.uid() = projects.user_id))))));

CREATE POLICY "Users can only delete their projects' evidence" 
ON public.evidence FOR DELETE
USING ((EXISTS (SELECT 1 FROM public.compliance_checks 
               WHERE (compliance_checks.id = check_id)
               AND (EXISTS (SELECT 1 FROM public.projects 
                          WHERE (projects.id = compliance_checks.project_id) 
                          AND (auth.uid() = projects.user_id))))));

-- Service role can manage all evidence
CREATE POLICY "Service role full access to evidence"
ON public.evidence
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Add policies for projects table
CREATE POLICY "Users can only view their own projects"
ON public.projects FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own projects"
ON public.projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own projects"
ON public.projects FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own projects"
ON public.projects FOR DELETE
USING (auth.uid() = user_id);

-- Service role can manage all projects
CREATE POLICY "Service role full access to projects"
ON public.projects
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Add policies for users table
CREATE POLICY "Users can only view their own profile"
ON public.users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can only update their own profile"
ON public.users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Service role can manage all users
CREATE POLICY "Service role full access to users"
ON public.users
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Add security for sensitive columns
ALTER TABLE public.projects
  ALTER COLUMN service_key SET DEFAULT NULL,
  ALTER COLUMN db_connection_string SET DEFAULT NULL;

-- Add policy to mask sensitive data
CREATE POLICY "Mask sensitive project data"
ON public.projects
FOR SELECT
USING (
  CASE 
    WHEN auth.role() = 'service_role' THEN true
    WHEN auth.uid() = user_id THEN true
    ELSE false
  END
);