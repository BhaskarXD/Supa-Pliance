import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { Pool } from 'pg';
import type { Database } from '@/types/supabase';
import { cookies } from 'next/headers';

/**
 * Returns a Supabase client that preserves user context and enforces RLS
 * This previously returned an admin client that bypassed RLS, but has been modified
 * to use the user's session for better security
 * 
 * @throws Error if user is not authenticated
 */
export async function getSupabaseAdmin() {
  const cookieStore = cookies();
  console.log('cookieStore', cookieStore);
  
  // Create client with user context from cookies
  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => 
              cookieStore.set(name, value, options)
            );
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        }
      }
    }
  );
  console.log('client', client);
  // Verify user is authenticated
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) {
    console.log('authError', authError);
    throw new Error('Authentication required');
  }
  console.log('user', user);
  
  return client;
}

/**
 * Creates a Supabase client for a specific project using its service key
 * This allows making admin-level API calls to the user's Supabase project
 * @param projectId - The ID of the project to connect to
 */
export async function getProjectSupabaseClient(projectId: string) {
  const adminSupabase = await getSupabaseAdmin();
  
  // Get the project's connection details
  const { data: project, error } = await adminSupabase
    .from('projects')
    .select('supabase_url, service_key')
    .eq('id', projectId)
    .single();
    
  if (error || !project) {
    throw new Error(`Failed to get project details: ${error?.message || 'Project not found'}`);
  }
  
  // Create a Supabase client for the specific project
  return createClient(project.supabase_url, project.service_key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Returns a PostgreSQL client for direct database access using project connection details
 * @param projectId - The project ID to connect to
 */
export async function getUserDbClient(projectId: string): Promise<Pool> {
  // Retrieve connection details from our database
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from('projects')
    .select('db_connection_string, supabase_url, service_key')
    .eq('id', projectId)
    .single();
  
  if (error || !data) {
    throw new Error(`Failed to get connection details: ${error?.message || 'No data found'}`);
  }
  
  // If we have a direct connection string, use that
  if (data.db_connection_string) {
    return new Pool({ connectionString: data.db_connection_string });
  }
  
  // Otherwise construct from service key and URL
  // Note: Using default PostgreSQL connection parameters
  // You may need to adjust this based on your actual database structure
  const url = new URL(data.supabase_url);
  const host = url.hostname;
  
  return new Pool({
    host,
    port: 5432, // Default PostgreSQL port
    database: 'postgres', // Default database name
    user: 'postgres', // Default user
    password: data.service_key,
    ssl: { rejectUnauthorized: false }
  });
}

// Helper function to log evidence with request/response details
export async function logEvidence(
  adminClient: SupabaseClient<Database>,
  checkId: string,
  content: string,
  severity: 'info' | 'warning' | 'error',
  details?: Record<string, any>
) {
  try {
    console.log('Logging evidence:', { checkId, content, severity, details });
    await adminClient
      .from('evidence')
      .insert({
        check_id: checkId,
        content,
        severity,
        type: 'log',
        metadata: details ? JSON.stringify(details) : null
      });
  } catch (error) {
    console.error('Error logging evidence:', error);
  }
}

/**
 * Creates a Supabase client for server components with cookie handling
 * This is now a simple wrapper around getSupabaseAdmin
 */
export async function createServerSupabaseClient() {
  // Just use the main function now that it returns a user client
  return getSupabaseAdmin();
}
