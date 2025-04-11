-- 20250408000000_fix_public_role_policies.sql

-- Fix compliance_checks policies
DROP POLICY IF EXISTS "Service role full access to compliance_checks" ON public.compliance_checks;
CREATE POLICY "Service role full access to compliance_checks"
ON public.compliance_checks FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Fix evidence policies
DROP POLICY IF EXISTS "Only authenticated users can create evidence" ON public.evidence;
DROP POLICY IF EXISTS "Service role full access to evidence" ON public.evidence;

CREATE POLICY "Only authenticated users can create evidence"
ON public.evidence FOR INSERT TO authenticated
WITH CHECK ((EXISTS (SELECT 1 FROM public.compliance_checks 
                   WHERE (compliance_checks.id = check_id)
                   AND (EXISTS (SELECT 1 FROM public.projects 
                              WHERE (projects.id = compliance_checks.project_id) 
                              AND (auth.uid() = projects.user_id))))));

CREATE POLICY "Service role full access to evidence"
ON public.evidence FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Fix projects policies
DROP POLICY IF EXISTS "Service role full access to projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

CREATE POLICY "Users can view their own projects"
ON public.projects FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
ON public.projects FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
ON public.projects FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
ON public.projects FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to projects"
ON public.projects FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Fix scans policies
DROP POLICY IF EXISTS "Service role full access to scans" ON public.scans;
CREATE POLICY "Service role full access to scans"
ON public.scans FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Fix test_messages policies
DROP POLICY IF EXISTS "Allow all operations" ON public.test_messages;
CREATE POLICY "Test data only for service role" 
ON public.test_messages FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Fix users policies
DROP POLICY IF EXISTS "Service role full access to users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;

CREATE POLICY "Users can view their own data"
ON public.users FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
ON public.users FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role full access to users"
ON public.users FOR ALL TO service_role
USING (true)
WITH CHECK (true);