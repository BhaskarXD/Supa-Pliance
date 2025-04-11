-- 20250407000000_fix_policy_roles.sql

-- Fix policies on scans to restrict to authenticated users
DROP POLICY IF EXISTS "Users can only view their own scans" ON public.scans;
DROP POLICY IF EXISTS "Users can only insert scans for their projects" ON public.scans;
DROP POLICY IF EXISTS "Users can only update their own scans" ON public.scans;
DROP POLICY IF EXISTS "Users can only delete their own scans" ON public.scans;

CREATE POLICY "Users can only view their own scans" 
ON public.scans FOR SELECT TO authenticated
USING ((EXISTS (SELECT 1 FROM public.projects 
               WHERE (projects.id = scans.project_id) 
               AND (auth.uid() = projects.user_id))));

CREATE POLICY "Users can only insert scans for their projects" 
ON public.scans FOR INSERT TO authenticated
WITH CHECK ((EXISTS (SELECT 1 FROM public.projects 
                   WHERE (projects.id = project_id) 
                   AND (auth.uid() = projects.user_id))));

CREATE POLICY "Users can only update their own scans" 
ON public.scans FOR UPDATE TO authenticated
USING ((EXISTS (SELECT 1 FROM public.projects 
               WHERE (projects.id = project_id) 
               AND (auth.uid() = projects.user_id))));

CREATE POLICY "Users can only delete their own scans" 
ON public.scans FOR DELETE TO authenticated
USING ((EXISTS (SELECT 1 FROM public.projects 
               WHERE (projects.id = project_id) 
               AND (auth.uid() = projects.user_id))));

-- Fix policies on compliance_checks
DROP POLICY IF EXISTS "Users can only view their projects' checks" ON public.compliance_checks;
DROP POLICY IF EXISTS "Users can only insert checks for their projects" ON public.compliance_checks;
DROP POLICY IF EXISTS "Users can only update their projects' checks" ON public.compliance_checks;
DROP POLICY IF EXISTS "Users can only delete their projects' checks" ON public.compliance_checks;

CREATE POLICY "Users can only view their projects' checks" 
ON public.compliance_checks FOR SELECT TO authenticated
USING ((EXISTS (SELECT 1 FROM public.projects 
               WHERE (projects.id = compliance_checks.project_id) 
               AND (auth.uid() = projects.user_id))));

CREATE POLICY "Users can only insert checks for their projects" 
ON public.compliance_checks FOR INSERT TO authenticated
WITH CHECK ((EXISTS (SELECT 1 FROM public.projects 
                   WHERE (projects.id = project_id) 
                   AND (auth.uid() = projects.user_id))));

CREATE POLICY "Users can only update their projects' checks" 
ON public.compliance_checks FOR UPDATE TO authenticated
USING ((EXISTS (SELECT 1 FROM public.projects 
               WHERE (projects.id = project_id) 
               AND (auth.uid() = projects.user_id))));

CREATE POLICY "Users can only delete their projects' checks" 
ON public.compliance_checks FOR DELETE TO authenticated
USING ((EXISTS (SELECT 1 FROM public.projects 
               WHERE (projects.id = project_id) 
               AND (auth.uid() = projects.user_id))));

-- Fix policies on evidence
DROP POLICY IF EXISTS "Users can only view their projects' evidence" ON public.evidence;
DROP POLICY IF EXISTS "Users can only insert evidence for their projects' checks" ON public.evidence;
DROP POLICY IF EXISTS "Users can only update their projects' evidence" ON public.evidence;
DROP POLICY IF EXISTS "Users can only delete their projects' evidence" ON public.evidence;

CREATE POLICY "Users can only view their projects' evidence" 
ON public.evidence FOR SELECT TO authenticated
USING ((EXISTS (SELECT 1 FROM public.compliance_checks 
               WHERE (compliance_checks.id = evidence.check_id)
               AND (EXISTS (SELECT 1 FROM public.projects 
                          WHERE (projects.id = compliance_checks.project_id) 
                          AND (auth.uid() = projects.user_id))))));

CREATE POLICY "Users can only insert evidence for their projects' checks" 
ON public.evidence FOR INSERT TO authenticated
WITH CHECK ((EXISTS (SELECT 1 FROM public.compliance_checks 
                   WHERE (compliance_checks.id = check_id)
                   AND (EXISTS (SELECT 1 FROM public.projects 
                              WHERE (projects.id = compliance_checks.project_id) 
                              AND (auth.uid() = projects.user_id))))));

CREATE POLICY "Users can only update their projects' evidence" 
ON public.evidence FOR UPDATE TO authenticated
USING ((EXISTS (SELECT 1 FROM public.compliance_checks 
               WHERE (compliance_checks.id = check_id)
               AND (EXISTS (SELECT 1 FROM public.projects 
                          WHERE (projects.id = compliance_checks.project_id) 
                          AND (auth.uid() = projects.user_id))))));

CREATE POLICY "Users can only delete their projects' evidence" 
ON public.evidence FOR DELETE TO authenticated
USING ((EXISTS (SELECT 1 FROM public.compliance_checks 
               WHERE (compliance_checks.id = check_id)
               AND (EXISTS (SELECT 1 FROM public.projects 
                          WHERE (projects.id = compliance_checks.project_id) 
                          AND (auth.uid() = projects.user_id))))));

-- Fix policies for projects table
DROP POLICY IF EXISTS "Users can only view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can only insert their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can only update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can only delete their own projects" ON public.projects;
DROP POLICY IF EXISTS "Mask sensitive project data" ON public.projects;

CREATE POLICY "Users can only view their own projects"
ON public.projects FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own projects"
ON public.projects FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own projects"
ON public.projects FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own projects"
ON public.projects FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Mask sensitive project data"
ON public.projects
FOR SELECT TO authenticated
USING (
  CASE 
    WHEN auth.role() = 'service_role' THEN true
    WHEN auth.uid() = user_id THEN true
    ELSE false
  END
);

-- Fix policies for users table
DROP POLICY IF EXISTS "Users can only view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can only update their own profile" ON public.users;

CREATE POLICY "Users can only view their own profile"
ON public.users FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can only update their own profile"
ON public.users FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Force RLS on all tables
ALTER TABLE public.scans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_checks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.test_messages FORCE ROW LEVEL SECURITY;