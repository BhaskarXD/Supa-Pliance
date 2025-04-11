import { createServerClient } from '@supabase/ssr';
import { Client } from 'pg';
import { Database } from '@/types/supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/utils/supabase-admin';
import { logEvidence } from '@/utils/supabase-admin';

interface TableInfo {
  table_name: string;
  has_rls: boolean;
  force_rls: boolean;
  description: string;
  policies: any[];
}

interface PgSetting {
  name: string;
  setting: string;
  unit: string | null;
  context: string;
  category: string;
}

interface ComplianceCheck {
  id: string;
  project_id: string;
  type: 'mfa' | 'rls' | 'pitr';
  status: 'pending' | 'running' | 'completed';
  result: boolean | null;
  details: string | null;
  timestamp: string | null;
}

// Initialize PostgreSQL client for direct database access
const createPgClient = (connectionString: string) => {
  return new Client({ connectionString });
};

// Initialize external Supabase client for checking customer's instance
// This doesn't need cookies as it's authenticating with service key directly
const createExternalClient = (supabaseUrl: string, serviceKey: string): SupabaseClient<Database> => {
  console.log(`Initializing external Supabase client at ${supabaseUrl}`);
  return createServerClient<Database>(
    supabaseUrl, 
    serviceKey,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // No-op for external client
        }
      }
    }
  );
};

// Main function to run checks
export async function runComplianceChecks(
  projectId: string, 
  serviceKey: string, 
  supabaseUrl: string,
  scanId: string,
) {
  console.log(`Starting compliance checks for project ${projectId}, scan ${scanId}`);
  
  // Admin client for accessing our database with service role (bypasses RLS)
  const adminClient = await getSupabaseAdmin();
  
  let pgClient: Client | null = null;
  
  try {
    // 1. Get project and its enabled checks using admin client to bypass RLS
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    
    if (projectError) {
      console.error(`Error fetching project: ${projectError.message}`);
      throw projectError;
    }
    
    if (!project) {
      console.error(`Project not found: ${projectId}`);
      throw new Error(`Project not found: ${projectId}`);
    }
    
    interface Project {
      id: string;
      name: string;
      enabled_checks: Record<string, boolean>;
      db_connection_string: string;
    }
    
    // Cast project to expected shape
    const projectData = project as Project;
    
    console.log(`Found project ${projectData.name} (${projectId})`);
    const enabledChecks = projectData.enabled_checks;
    console.log(`Enabled checks:`, enabledChecks);
    
    // Initialize PostgreSQL client for direct database access
    try {
      pgClient = createPgClient(projectData.db_connection_string);
      await pgClient.connect();
    } catch (connError: any) {
      console.error('Failed to connect to PostgreSQL:', connError);
      await logEvidence(
        adminClient,
        '', // No check ID yet
        'Failed to connect to PostgreSQL database',
        'error',
        { error: connError.message, scanId }
      );
      
      // Update scan status to failed
      await adminClient
        .from('scans')
        .update({ 
          status: 'failed', 
          completed_at: new Date().toISOString(),
          summary: { error: 'Database connection failed' }
        })
        .eq('id', scanId);
        
      throw connError;
    }
    
    // Create Supabase client for auth API (MFA checks)
    const supabaseClient = createExternalClient(supabaseUrl, serviceKey);
    
    // 2. Run checks sequentially in order: MFA -> RLS -> PITR
    const checkOrder = ['mfa', 'rls', 'pitr'] as const;
    
    for (const checkType of checkOrder) {
      if (!enabledChecks[checkType]) {
        console.log(`Skipping ${checkType} check - not enabled`);
        continue;
      }
      
      console.log(`Starting ${checkType} check`);
      
      try {
        switch (checkType) {
          case 'mfa':
            await checkMFA(supabaseClient, adminClient, projectId, scanId);
            break;
          case 'rls':
            if (pgClient) {
              await checkRLS(pgClient, adminClient, projectId, scanId);
            }
            break;
          case 'pitr':
            if (pgClient) {
              await checkPITR(pgClient, adminClient, projectId, scanId);
            }
            break;
        }
      } catch (error: any) {
        console.error(`Error running ${checkType} check:`, error);
        // Log the error as evidence
        await logEvidence(
          adminClient,
          '', // No check ID in this context
          `Error running ${checkType} check: ${error.message}`,
          'error',
          { error: error.message, stack: error.stack, scanId }
        );
        // Continue with next check even if one fails
      }
    }
    
    console.log('All checks completed');
    
    // Get summary of checks for this scan
    const { data: scanChecks } = await adminClient
      .from('compliance_checks')
      .select('id, result, status')
      .eq('scan_id', scanId);
      
    const totalChecks = scanChecks?.length || 0;
    const passedChecks = scanChecks?.filter(c => c.result === true).length || 0;
    const failedChecks = scanChecks?.filter(c => c.result === false).length || 0;
    
    // Update scan status to completed
    await adminClient
      .from('scans')
      .update({ 
        status: 'completed', 
        completed_at: new Date().toISOString(),
        summary: {
          total_checks: totalChecks,
          passed_checks: passedChecks,
          failed_checks: failedChecks
        }
      })
      .eq('id', scanId);
    
    // 3. Update project status to completed
    await adminClient
      .from('projects')
      .update({ status: 'completed', last_scan_at: new Date().toISOString() })
      .eq('id', projectId);
    
    console.log(`Scan ${scanId} for project ${projectId} completed`);
      
  } catch (error: any) {
    console.error('Error running compliance checks:', error);
    
    // Update scan status to failed
    await adminClient
      .from('scans')
      .update({ 
        status: 'failed', 
        completed_at: new Date().toISOString(),
        summary: { error: error.message }
      })
      .eq('id', scanId);
    
    // Update project status to failed
    await adminClient
      .from('projects')
      .update({ 
        status: 'failed',
        last_scan_at: new Date().toISOString()
      })
      .eq('id', projectId);
      
    throw error;
  } finally {
    // Always close the PostgreSQL client connection
    if (pgClient) {
      try {
        await pgClient.end();
        console.log('PostgreSQL client connection closed');
      } catch (closeError) {
        console.error('Error closing PostgreSQL client:', closeError);
      }
    }
  }
}

// Check if MFA is enabled for each user
async function checkMFA(
  externalClient: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  projectId: string,
  scanId: string
): Promise<void> {
  let currentCheck: ComplianceCheck | null = null;
  
  try {
    // Get the MFA check for this scan
    const { data: checks, error: checkError } = await adminClient
      .from('compliance_checks')
      .select('*')
      .eq('project_id', projectId)
      .eq('scan_id', scanId)
      .eq('type', 'mfa')
      .single();
    
    if (checkError) {
      console.error(`Error fetching MFA check: ${checkError.message}`);
      throw checkError;
    }
    
    currentCheck = checks as ComplianceCheck;
    
    await logEvidence(
      adminClient,
      currentCheck.id,
      'Starting MFA compliance check',
      'info',
      { checkType: 'mfa', scanId }
    );
    
    // Use auth admin API to list users
    const { data: { users }, error: usersError } = await externalClient.auth.admin.listUsers();
    
    if (usersError) {
      await logEvidence(
        adminClient, 
        currentCheck.id, 
        `Error retrieving users: ${usersError.message}`, 
        'error',
        { error: usersError }
      );
      throw usersError;
    }
    
    await logEvidence(
      adminClient,
      currentCheck.id,
      `Retrieved ${users?.length || 0} users from Supabase Auth`,
      'info',
      { total_users: users?.length || 0 }
    );

    // Analyze each user's MFA status
    const userDetails = users?.map(user => ({
      id: user.id,
      email: user.email,
      mfa_enabled: user.factors && user.factors.length > 0,
      mfa_factors: user.factors?.map(f => f.factor_type) || [],
      created_at: user.created_at,
      last_sign_in: user.last_sign_in_at
    })) || [];

    const usersWithMFA = userDetails.filter(u => u.mfa_enabled);
    const usersWithoutMFA = userDetails.filter(u => !u.mfa_enabled);
    
    // Log detailed evidence for each user
    for (const user of userDetails) {
      await logEvidence(
        adminClient,
        currentCheck.id,
        `User ${user.email}: MFA ${user.mfa_enabled ? 'enabled' : 'disabled'}`,
        user.mfa_enabled ? 'info' : 'warning',
        {
          user_id: user.id,
          email: user.email,
          mfa_status: user.mfa_enabled,
          mfa_factors: user.mfa_factors,
          created_at: user.created_at,
          last_sign_in: user.last_sign_in
        }
      );
    }
    
    // Update check status with detailed results
    await adminClient
      .from('compliance_checks')
      .update({
        status: 'completed',
        result: usersWithoutMFA.length === 0,
        details: JSON.stringify({
          total_users: users?.length || 0,
          users_with_mfa: usersWithMFA.length,
          users_without_mfa: usersWithoutMFA.length,
          compliance_percentage: users?.length ? (usersWithMFA.length / users.length) * 100 : 0,
          users: userDetails.map(user => ({
            email: user.email,
            mfa_enabled: user.mfa_enabled,
            mfa_factors: user.mfa_factors
          }))
        })
      })
      .eq('id', currentCheck.id);
      
  } catch (error: any) {
    console.error('MFA check error:', error);
    await logEvidence(
      adminClient,
      currentCheck?.id || '',
      'MFA check failed',
      'error',
      { error: error.message, stack: error.stack }
    );
    
    const updateQuery = adminClient
      .from('compliance_checks')
      .update({
        status: 'completed',
        result: null,
        details: JSON.stringify({ error: error.message })
      });
      
    if (currentCheck?.id) {
      await updateQuery.eq('id', currentCheck.id);
    } else {
      await updateQuery
        .eq('type', 'mfa')
        .eq('project_id', projectId)
        .eq('scan_id', scanId)
        .order('timestamp', { ascending: false })
        .limit(1);
    }
  }
}

// Check RLS using direct PostgreSQL access
async function checkRLS(
  pgClient: Client,
  adminClient: SupabaseClient<Database>,
  projectId: string,
  scanId: string
): Promise<void> {
  let currentCheck: ComplianceCheck | null = null;
  
  try {
    const { data: checks, error: checkError } = await adminClient
      .from('compliance_checks')
      .select('*')
      .eq('project_id', projectId)
      .eq('type', 'rls')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
    
    if (checkError || !checks) {
      throw new Error(`RLS check not found for project ${projectId}`);
    }
    
    currentCheck = {
      ...checks,
      type: 'rls' as const
    } as ComplianceCheck;
    
    await adminClient
      .from('compliance_checks')
      .update({ status: 'running' })
      .eq('id', currentCheck.id);
    
    await logEvidence(
      adminClient,
      currentCheck.id,
      'Starting RLS compliance check',
      'info',
      { timestamp: new Date().toISOString() }
    );
    
    // Get all tables in public schema
    const tablesResult = await pgClient.query<TableInfo>(`
      SELECT 
        c.relname as table_name,
        c.relrowsecurity as has_rls,
        c.relforcerowsecurity as force_rls,
        obj_description(c.oid) as description
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r';
    `);
    
    const tables = tablesResult.rows;
    
    await logEvidence(
      adminClient,
      currentCheck.id,
      `Found ${tables.length} tables in the public schema`,
      'info',
      { total_tables: tables.length }
    );
    
    // Get RLS policies for each table
    const tableDetails = await Promise.all(
      tables.map(async (table) => {
        const policiesResult = await pgClient.query(`
          SELECT 
            polname as policy_name,
            polcmd as command,
            polroles::text[] as roles,
            polqual::text as expression
          FROM pg_policy
          JOIN pg_class ON pg_class.oid = pg_policy.polrelid
          WHERE pg_class.relname = $1;
        `, [table.table_name]);
        
        return {
          ...table,
          policies: policiesResult.rows
        };
      })
    );
    
    // Log detailed evidence for each table
    for (const table of tableDetails) {
      await logEvidence(
        adminClient,
        currentCheck.id,
        `Table ${table.table_name}: RLS ${table.has_rls ? 'enabled' : 'disabled'}`,
        table.has_rls ? 'info' : 'warning',
        {
          table_name: table.table_name,
          has_rls: table.has_rls,
          force_rls: table.force_rls,
          description: table.description,
          policies: table.policies
        }
      );
      
      // Log each policy
      for (const policy of table.policies) {
        await logEvidence(
          adminClient,
          currentCheck.id,
          `Policy "${policy.policy_name}" on table ${table.table_name}`,
          'info',
          {
            policy_name: policy.policy_name,
            command: policy.command,
            roles: policy.roles,
            expression: policy.expression
          }
        );
      }
    }
    
    const tablesWithoutRLS = tableDetails.filter(t => !t.has_rls);
    
    // Update check status with detailed results
    await adminClient
      .from('compliance_checks')
      .update({
        status: 'completed',
        result: tablesWithoutRLS.length === 0,
        details: JSON.stringify({
          total_tables: tables.length,
          tables_with_rls: tables.length - tablesWithoutRLS.length,
          tables_without_rls: tablesWithoutRLS.length,
          compliance_percentage: (tables.length - tablesWithoutRLS.length) / tables.length * 100,
          tables: tableDetails.map(table => ({
            name: table.table_name,
            rls_enabled: table.has_rls,
            force_rls: table.force_rls,
            policy_count: table.policies.length,
            policies: table.policies.map(p => ({
              name: p.policy_name,
              command: p.command,
              roles: p.roles
            }))
          }))
        })
      })
      .eq('id', currentCheck.id);
      
  } catch (error: any) {
    console.error('RLS check error:', error);
    await logEvidence(
      adminClient,
      currentCheck?.id || '',
      'RLS check failed',
      'error',
      { error: error.message, stack: error.stack }
    );
    
    const updateQuery = adminClient
      .from('compliance_checks')
      .update({
        status: 'completed',
        result: null,
        details: JSON.stringify({ error: error.message })
      });
      
    if (currentCheck?.id) {
      await updateQuery.eq('id', currentCheck.id);
    } else {
      await updateQuery
        .eq('type', 'rls')
        .eq('project_id', projectId)
        .eq('scan_id', scanId)
        .order('timestamp', { ascending: false })
        .limit(1);
    }
  }
}

// Check PITR using direct PostgreSQL access
async function checkPITR(
  pgClient: Client,
  adminClient: SupabaseClient<Database>,
  projectId: string,
  scanId: string
): Promise<void> {
  let currentCheck: ComplianceCheck | null = null;
  
  try {
    const { data: checks, error: checkError } = await adminClient
      .from('compliance_checks')
      .select('*')
      .eq('project_id', projectId)
      .eq('type', 'pitr')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
    
    if (checkError || !checks) {
      throw new Error(`PITR check not found for project ${projectId}`);
    }
    
    currentCheck = {
      ...checks,
      type: 'pitr' as const
    } as ComplianceCheck;
    
    await adminClient
      .from('compliance_checks')
      .update({ status: 'running' })
      .eq('id', currentCheck.id);
    
    await logEvidence(
      adminClient,
      currentCheck.id,
      'Starting PITR compliance check',
      'info',
      { timestamp: new Date().toISOString() }
    );
    
    // Get all relevant WAL and backup settings
    const settingsResult = await pgClient.query<PgSetting>(`
      SELECT name, setting, unit, context, category
      FROM pg_settings
      WHERE name IN (
        'archive_mode',
        'archive_command',
        'archive_timeout',
        'wal_level',
        'max_wal_senders',
        'wal_keep_size',
        'checkpoint_timeout',
        'checkpoint_completion_target'
      );
    `);
    
    const settings = settingsResult.rows;
    
    // Get WAL archiving status
    const walResult = await pgClient.query(`
      SELECT
        pg_current_wal_lsn() as current_wal_lsn,
        pg_walfile_name(pg_current_wal_lsn()) as current_wal_file,
        pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0') as wal_bytes_written
    `);
    
    const walStatus = walResult.rows[0];
    
    // Check archive status
    const archiveResult = await pgClient.query(`
      SELECT archived_count, failed_count, last_archived_wal, last_failed_wal
      FROM pg_stat_archiver;
    `);
    
    const archiveStatus = archiveResult.rows[0];
    
    // Log detailed evidence for PITR configuration
    await logEvidence(
      adminClient,
      currentCheck.id,
      'Retrieved PITR configuration settings',
      'info',
      { settings }
    );
    
    await logEvidence(
      adminClient,
      currentCheck.id,
      'Retrieved WAL archiving status',
      'info',
      { 
        wal_status: walStatus,
        archive_status: archiveStatus
      }
    );
    
    const pitrEnabled = settings.some(s => 
      s.name === 'archive_mode' && s.setting === 'on'
    );
    
    const walLevelValid = settings.some(s =>
      s.name === 'wal_level' && ['replica', 'logical'].includes(s.setting)
    );
    
    // Update check status with detailed results
    await adminClient
      .from('compliance_checks')
      .update({
        status: 'completed',
        result: pitrEnabled && walLevelValid,
        details: JSON.stringify({
          pitr_enabled: pitrEnabled && walLevelValid,
          settings: settings.reduce((acc, s) => ({
            ...acc,
            [s.name]: {
              value: s.setting,
              unit: s.unit,
              context: s.context,
              category: s.category
            }
          }), {}),
          wal_status: {
            current_lsn: walStatus.current_wal_lsn,
            current_file: walStatus.current_wal_file,
            bytes_written: walStatus.wal_bytes_written
          },
          archive_status: {
            archived_count: archiveStatus.archived_count,
            failed_count: archiveStatus.failed_count,
            last_archived: archiveStatus.last_archived_wal,
            last_failed: archiveStatus.last_failed_wal
          }
        })
      })
      .eq('id', currentCheck.id);
      
  } catch (error: any) {
    console.error('PITR check error:', error);
    await logEvidence(
      adminClient,
      currentCheck?.id || '',
      'PITR check failed',
      'error',
      { error: error.message, stack: error.stack }
    );
    
    const updateQuery = adminClient
      .from('compliance_checks')
      .update({
        status: 'completed',
        result: null,
        details: JSON.stringify({ error: error.message })
      });
      
    if (currentCheck?.id) {
      await updateQuery.eq('id', currentCheck.id);
    } else {
      await updateQuery
        .eq('type', 'pitr')
        .eq('project_id', projectId)
        .eq('scan_id', scanId)
        .order('timestamp', { ascending: false })
        .limit(1);
    }
  }
} 