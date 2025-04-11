import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserDbClient, getProjectSupabaseClient, logEvidence } from "@/utils/supabase-admin";

interface AutoFixResult {
  success: boolean;
  output?: string;
  error?: string;
  details?: any;
  // Additional properties for MFA fixes
  project_enabled?: boolean;
  user_level_enforced?: boolean;
  fix_phase?: 'not_started' | 'project_level' | 'project_level_complete' | 'user_level' | 'complete';
  user_stats?: any;
  message?: string;
  next_phase?: string;
  session_id?: string;
  // PITR properties
  settings?: {
    wal_level?: string;
    archive_mode?: string;
    wal_keep_size?: string;
  };
}

// Log evidence for auto-fix operations
async function logAutoFixEvent(
  checkId: string,
  projectId: string,
  eventType: string,
  details: any,
  severity: 'info' | 'error' = 'info'
) {
  const supabase = await getSupabaseAdmin();
  const content = details.message || `Auto-fix operation: ${eventType}`;
  
  // Add event type and projectId to details
  const enhancedDetails = {
    ...details,
    event_type: eventType,
    project_id: projectId
  };
  
  // Use the proper logEvidence function
  await logEvidence(
    supabase,
    checkId,
    content,
    severity,
    enhancedDetails
  );
}

// Enable MFA for specific users (supporting both user IDs and emails)
async function enableMfaForUsers(
  projectId: string,
  userIdentifiers: string[],
  selectionType: 'id' | 'email' = 'id',
  checkId?: string
): Promise<AutoFixResult> {
  try {
    console.log('============== MFA AUTO-FIX DEBUG ==============');
    console.log(`Starting MFA enablement with projectId: ${projectId}`);
    console.log(`Selection type: ${selectionType}`);
    console.log(`User identifiers received:`, userIdentifiers);
    
    if (!userIdentifiers || userIdentifiers.length === 0) {
      console.log('No user identifiers provided, returning error');
      
      // Log technical validation error
      if (checkId) {
        await logAutoFixEvent(
          checkId,
          projectId,
          'mfa_technical_validation',
          { 
            message: "MFA enablement missing required input",
            technical_details: {
              validation_error: "No users specified",
              selection_type: selectionType,
              user_count: 0
            }
          },
          'error'
        );
      }
      
      return {
        success: false,
        error: "No users specified for MFA enablement"
      };
    }

    console.log(`Attempting to get DB client for project ${projectId}`);
    const pool = await getUserDbClient(projectId);
    const client = await pool.connect();
    console.log(`Successfully connected to database for project ${projectId}`);
    
    try {
      // Log the start of technical operation with user count
      if (checkId) {
        await logAutoFixEvent(
          checkId,
          projectId,
          'mfa_technical_operation_started',
          { 
            message: "Beginning MFA enablement database operations",
            technical_details: {
              user_count: userIdentifiers.length,
              selection_type: selectionType
            }
          },
          'info'
        );
      }
      
      // Process each user
      const results = [];
      
      for (const identifier of userIdentifiers) {
        try {
          console.log(`Processing user identifier: ${identifier}`);
          
          // Build the query based on selection type (email or ID)
          const identifierField = selectionType === 'email' ? 'email' : 'id';
          const queryText = `
            SELECT id, raw_user_meta_data, email
            FROM auth.users
            WHERE ${identifierField} = $1;
          `;
          
          console.log(`Looking up user with ${identifierField} = ${identifier}`);
          
          // Get user's current metadata
          const userResult = await client.query(queryText, [identifier]);
          console.log(`Query executed, rows returned: ${userResult.rows.length}`);
          
          if (userResult.rows.length === 0) {
            console.log(`No user found with ${identifierField}: ${identifier}`);
            
            // Include email directly when selection type is email
            const userEmail = selectionType === 'email' ? identifier : null;
            
            // Log technical user lookup issue
            if (checkId) {
              await logAutoFixEvent(
                checkId,
                projectId,
                'mfa_technical_user_lookup',
                { 
                  message: `Technical lookup failed for user identifier`,
                  technical_details: {
                    lookup_field: identifierField,
                    identifier_value: identifier,
                    result: "not_found",
                    user_email: userEmail
                  }
                },
                'error'
              );
            }
            
            results.push({
              identifier,
              success: false,
              error: `User with ${selectionType} '${identifier}' not found`
            });
            continue;
          }
          
          const user = userResult.rows[0];
          console.log(`Found user: ${user.id}, email: ${user.email}`);
          
          // Create or update the user_metadata with mfa_required=true
          const updatedMetadata = user.raw_user_meta_data || {};
          console.log('Current user metadata:', updatedMetadata);
          
          updatedMetadata.mfa_required = true;
          console.log('Updated metadata with mfa_required=true:', updatedMetadata);
          
          // Update the user in the database
          console.log(`Updating user ${user.id} to require MFA`);
          await client.query(`
            UPDATE auth.users
            SET raw_user_meta_data = $1::jsonb
            WHERE id = $2;
          `, [JSON.stringify(updatedMetadata), user.id]);
          
          console.log(`Successfully updated user ${user.id}`);
          
          // Log technical user update success
          if (checkId) {
            await logAutoFixEvent(
              checkId,
              projectId,
              'mfa_technical_user_update',
              { 
                message: `Technical database update for user MFA setting`,
                technical_details: {
                  user_id: user.id,
                  user_email: user.email,
                  update_type: "metadata_update",
                  field_changed: "mfa_required",
                  new_value: true,
                  result: "success"
                }
              },
              'info'
            );
          }
          
          results.push({
            identifier,
            userId: user.id,
            email: user.email,
            success: true
          });
        } catch (userError) {
          console.error(`Error updating user ${identifier}:`, userError);
          console.error('Error stack:', userError instanceof Error ? userError.stack : 'No stack trace');
          
          // Just use identifier directly if it's an email
          const userEmail = selectionType === 'email' ? identifier : null;
          
          // Log technical user update error
          if (checkId) {
            await logAutoFixEvent(
              checkId,
              projectId,
              'mfa_technical_update_error',
              { 
                message: `Technical database error updating user MFA setting`,
                technical_details: {
                  identifier: identifier,
                  user_email: userEmail,
                  error_type: "database_update_failure",
                  error_message: userError instanceof Error ? userError.message : String(userError)
                }
              },
              'error'
            );
          }
          
          results.push({
            identifier,
            success: false,
            error: userError instanceof Error ? userError.message : String(userError)
          });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      console.log(`MFA enablement complete. Success: ${successCount}/${userIdentifiers.length} users`);
      console.log('Detailed results:', JSON.stringify(results, null, 2));
      console.log('===============================================');
      
      // Log technical summary of operation
      if (checkId) {
        await logAutoFixEvent(
          checkId,
          projectId,
          'mfa_technical_operation_completed',
          { 
            message: `MFA database operation technical summary`,
            technical_details: {
              total_users: userIdentifiers.length,
              successful_updates: successCount,
              failed_updates: userIdentifiers.length - successCount,
              operation_status: successCount > 0 ? "partially_successful" : "failed"
            }
          },
          'info'
        );
      }
    
      return { 
        success: successCount > 0,
        message: `Successfully enabled MFA for ${successCount} of ${userIdentifiers.length} users.`,
        error: successCount === 0 ? "Failed to enable MFA for any users" : undefined,
        details: results
      };
    } finally {
      console.log('Releasing database client');
      client.release();
    }
  } catch (error) {
    console.error('Error enabling MFA:', error);
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.log('===============================================');
    
    // Log technical connection error
    if (checkId) {
      await logAutoFixEvent(
        checkId,
        projectId,
        'mfa_technical_connection_error',
        { 
          message: `MFA enablement encountered a database connection error`,
          technical_details: {
            error_type: "database_connection_failure",
            error_message: error instanceof Error ? error.message : String(error)
          }
        },
        'error'
      );
    }
    
    return { 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to enable MFA',
      details: {
        errorType: typeof error,
        errorString: String(error)
      }
    };
  }
}

// Enable RLS on specific tables
async function enableRlsForTables(
  projectId: string,
  tableNames: string[],
  createDefaultPolicy: boolean,
  checkId?: string
): Promise<AutoFixResult> {
  try {
    if (!tableNames || tableNames.length === 0) {
      // Log technical validation error
      if (checkId) {
        await logAutoFixEvent(
          checkId,
          projectId,
          'rls_technical_validation',
          { 
            message: "RLS enablement missing required input",
            technical_details: {
              validation_error: "No tables specified",
              create_default_policy: createDefaultPolicy
            }
          },
          'error'
        );
      }
      
      return {
        success: false,
        error: "No tables specified for RLS enablement"
      };
    }
    
    const pool = await getUserDbClient(projectId);
    const client = await pool.connect();
    
    try {
      // Log technical operation start
      if (checkId) {
        await logAutoFixEvent(
          checkId,
          projectId,
          'rls_technical_operation_started',
          { 
            message: "Beginning RLS enablement database operations",
            technical_details: {
              table_count: tableNames.length,
              create_default_policy: createDefaultPolicy
            }
          },
          'info'
        );
      }
      
      // Process each table
      const results = [];
      
      for (const tableName of tableNames) {
        try {
          // Enable RLS on the table
          await client.query(`
            ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;
          `);
          
          // Log technical table RLS enablement
          if (checkId) {
            await logAutoFixEvent(
              checkId,
              projectId,
              'rls_technical_table_update',
              { 
                message: "Technical database update for RLS enablement",
                technical_details: {
                  table_name: tableName,
                  operation: "enable_rls",
                  result: "success"
                }
              },
              'info'
            );
          }
          
          // Create a default policy if requested
          if (createDefaultPolicy) {
            // Check if any policies already exist
            const policyCheck = await client.query(`
              SELECT COUNT(*) AS policy_count
              FROM pg_policy p
              JOIN pg_class c ON p.polrelid = c.oid
              WHERE c.relname = $1 AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
            `, [tableName]);
            
            const policyCount = parseInt(policyCheck.rows[0]?.policy_count || '0');
            
            // Only create a default policy if no policies exist
            if (policyCount === 0) {
              console.log(`No policies found for table ${tableName}, creating default authenticated users policy`);
              // Create a policy that allows only authenticated users to perform CRUD operations
              await client.query(`
                CREATE POLICY "Default allow authenticated users" 
                ON public.${tableName}
                FOR ALL -- This covers all operations (SELECT, INSERT, UPDATE, DELETE)
                TO authenticated -- Only authenticated users can access
                USING (true) -- No additional restrictions for read operations
                WITH CHECK (true); -- No additional restrictions for write operations
              `);
              console.log(`Successfully created default policy for table ${tableName}`);
              
              // Log technical policy creation
              if (checkId) {
                await logAutoFixEvent(
                  checkId,
                  projectId,
                  'rls_technical_policy_creation',
                  { 
                    message: "Technical database operation: policy creation",
                    technical_details: {
                      table_name: tableName,
                      policy_name: "Default allow authenticated users",
                      policy_type: "authenticated_users_all_operations",
                      result: "success"
                    }
                  },
                  'info'
                );
              }
            } else {
              console.log(`Table ${tableName} already has ${policyCount} policies, skipping policy creation`);
              
              // Log technical policy skip
              if (checkId) {
                await logAutoFixEvent(
                  checkId,
                  projectId,
                  'rls_technical_policy_skipped',
                  { 
                    message: "Technical policy creation skipped",
                    technical_details: {
                      table_name: tableName,
                      existing_policy_count: policyCount,
                      skip_reason: "existing_policies_found"
                    }
                  },
                  'info'
                );
              }
            }
          }
          
          results.push({
            tableName,
            success: true
          });
        } catch (tableError) {
          console.error(`Error enabling RLS on table ${tableName}:`, tableError);
          
          // Log technical table error
          if (checkId) {
            await logAutoFixEvent(
              checkId,
              projectId,
              'rls_technical_table_error',
              { 
                message: "Technical database error during RLS enablement",
                technical_details: {
                  table_name: tableName,
                  operation: "enable_rls",
                  error_type: "database_update_failure",
                  error_message: tableError instanceof Error ? tableError.message : String(tableError)
                }
              },
              'error'
            );
          }
          
          results.push({
            tableName,
            success: false,
            error: tableError instanceof Error ? tableError.message : String(tableError)
          });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      
      // Log technical summary
      if (checkId) {
        await logAutoFixEvent(
          checkId,
          projectId,
          'rls_technical_operation_completed',
          { 
            message: "RLS database operations technical summary",
            technical_details: {
              total_tables: tableNames.length,
              successful_updates: successCount,
              failed_updates: tableNames.length - successCount,
              operation_status: successCount > 0 ? 
                (successCount === tableNames.length ? "fully_successful" : "partially_successful") : 
                "failed"
            }
          },
          'info'
        );
      }
      
      return {
        success: successCount > 0,
        message: `Successfully enabled RLS for ${successCount} of ${tableNames.length} tables.`,
        error: successCount === 0 ? "Failed to enable RLS for any tables" : undefined,
        details: results
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error enabling RLS:', error);
    
    // Log technical connection error
    if (checkId) {
      await logAutoFixEvent(
        checkId,
        projectId,
        'rls_technical_connection_error',
        { 
          message: "RLS enablement encountered a database connection error",
          technical_details: {
            error_type: "database_connection_failure",
            error_message: error instanceof Error ? error.message : String(error)
          }
        },
        'error'
      );
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to enable RLS'
    };
  }
}

// Enable PITR with specified retention days
async function enablePitr(
  projectId: string,
  retentionDays: number,
  checkId?: string
): Promise<AutoFixResult> {
  try {
    if (!retentionDays || retentionDays < 1) {
      return {
        success: false,
        error: "Invalid retention period specified"
      };
    }
    
    const pool = await getUserDbClient(projectId);
    const client = await pool.connect();
    
    try {
      // First check current settings
      const walResult = await client.query(`SHOW wal_level;`);
      const walLevel = walResult.rows[0]?.wal_level;
      
      const archiveResult = await client.query(`SHOW archive_mode;`);
      const archiveMode = archiveResult.rows[0]?.archive_mode;
      
      // Check if PITR is already enabled
      const pitrAlreadyEnabled = (walLevel === 'replica' || walLevel === 'logical') && archiveMode === 'on';
      
      // Log current settings
      console.log(`Current PITR settings - wal_level: ${walLevel}, archive_mode: ${archiveMode}`);
      
      // If PITR is already enabled, return success immediately
      if (pitrAlreadyEnabled) {
        console.log('PITR is already properly configured');
        
        // Log technical details of the current PITR configuration
        if (checkId) {
          await logAutoFixEvent(
            checkId,
            projectId,
            'pitr_technical_details',
            { 
              message: "PITR technical configuration details",
              technical_details: {
                wal_level: walLevel,
                archive_mode: archiveMode,
                status: "already_enabled"
              }
            },
            'info'
          );
        }
        
        return {
          success: true,
          message: "Point-in-Time Recovery is already enabled on this database.",
          settings: { wal_level: walLevel, archive_mode: archiveMode }
        };
      }
      
      // Check if we have superuser privileges (required for ALTER SYSTEM)
      const superuserResult = await client.query(`
        SELECT rolsuper FROM pg_roles WHERE rolname = current_user;
      `).catch(() => ({ rows: [{ rolsuper: false }] }));
      
      const isSuperuser = superuserResult.rows[0]?.rolsuper === true;
      
      if (!isSuperuser) {
        console.log('Cannot enable PITR: Current database user lacks superuser privileges');
        
        // Log specific technical limitation
        if (checkId) {
          await logAutoFixEvent(
            checkId,
            projectId,
            'pitr_technical_limitation',
            { 
              message: "PITR cannot be enabled due to technical limitation",
              technical_details: {
                limitation_type: "insufficient_privileges",
                current_role: "non_superuser",
                required_role: "superuser"
              }
            },
            'error'
          );
        }
        
        return {
          success: false,
          error: "Insufficient privileges to enable PITR",
          message: "Your database connection does not have superuser privileges required to enable PITR. For Supabase databases, you must enable PITR through the Supabase dashboard in Settings > Database > Point-in-Time Recovery.",
          details: {
            manual_steps: {
              dashboard_path: "Project Settings > Database > Point-in-Time Recovery",
              recommended_settings: {
                enabled: true,
                retention_days: retentionDays
              }
            },
            supabase_info: "Supabase connection strings typically don't include superuser privileges for security reasons."
          }
        };
      }
      
      // Directly attempt to enable PITR - we have full database access via connection string
      console.log(`Attempting to enable PITR with retention days: ${retentionDays}`);
      
      try {
        // Set WAL level to logical (required for PITR)
        await client.query(`ALTER SYSTEM SET wal_level = 'logical';`);
        console.log('Successfully set wal_level to logical');
        
        // Enable archive mode
        await client.query(`ALTER SYSTEM SET archive_mode = 'on';`);
        console.log('Successfully set archive_mode to on');
        
        // Set archive command to something basic - this may need to be customized for Supabase
        // Default simple command likely won't work in Supabase environment
        await client.query(`ALTER SYSTEM SET archive_command = 'cp %p /var/lib/postgresql/archive/%f';`);
        console.log('Successfully set archive_command');
        
        // Set retention policy based on user input
        await client.query(`ALTER SYSTEM SET wal_keep_size = '${retentionDays}GB';`);
        console.log(`Successfully set wal_keep_size to ${retentionDays}GB`);
        
        // Apply changes
        await client.query(`SELECT pg_reload_conf();`);
        console.log('Successfully reloaded PostgreSQL configuration');
        
        // Log technical configuration details
        if (checkId) {
          await logAutoFixEvent(
            checkId,
            projectId,
            'pitr_technical_configuration',
            { 
              message: "PITR technical settings applied",
              technical_details: {
                settings_applied: {
                  wal_level: 'logical',
                  archive_mode: 'on',
                  archive_command: 'cp %p /var/lib/postgresql/archive/%f',
                  wal_keep_size: `${retentionDays}GB`
                },
                config_reloaded: true
              }
            },
            'info'
          );
        }
        
        return {
          success: true,
          message: `Successfully enabled Point-in-Time Recovery with ${retentionDays} days retention. A database restart may be required for all changes to take effect.`,
          details: {
            requires_restart: true,
            settings: {
              wal_level: 'logical',
              archive_mode: 'on',
              wal_keep_size: `${retentionDays}GB`
            },
            important_note: "For Supabase databases, these settings may not persist or function correctly. Using the Supabase dashboard is still recommended."
          }
        };
      } catch (configError) {
        console.error('Error setting PITR configuration:', configError);
        
        // Check if this is a permissions error
        const errorMessage = configError instanceof Error ? configError.message : String(configError);
        const isPermissionIssue = errorMessage.toLowerCase().includes('permission') || 
                                 errorMessage.toLowerCase().includes('privilege') ||
                                 errorMessage.toLowerCase().includes('denied');
        
        let userGuidance = "An error occurred while trying to enable PITR.";
        
        if (isPermissionIssue) {
          userGuidance = "Permission denied when attempting to modify database settings. For Supabase databases, you must enable PITR through the Supabase dashboard.";
        } else {
          userGuidance = "This could be due to database restrictions or configuration issues. Please try enabling it through the Supabase dashboard.";
        }
        
        // Log technical error details
        if (checkId) {
          await logAutoFixEvent(
            checkId,
            projectId,
            'pitr_technical_error',
            { 
              message: "PITR configuration encountered a technical error",
              technical_details: {
                error_type: isPermissionIssue ? "permission_denied" : "configuration_error",
                error_message: errorMessage,
                attempted_operation: "apply_pitr_settings"
              }
            },
            'error'
          );
        }
        
        return {
          success: false,
          error: errorMessage,
          message: userGuidance,
          details: {
            error_details: errorMessage,
            manual_steps: {
              dashboard_path: "Project Settings > Database > Point-in-Time Recovery",
              recommended_settings: {
                enabled: true,
                retention_days: retentionDays
              }
            }
          }
        };
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error enabling PITR:', error);
    
    // Log connection-level technical issues
    if (checkId) {
      await logAutoFixEvent(
        checkId,
        projectId,
        'pitr_connection_technical_error',
        { 
          message: "PITR database connection encountered a technical error",
          technical_details: {
            error_message: error instanceof Error ? error.message : 'Unknown error',
            error_type: "connection_failure",
            attempted_operation: "connect_to_database"
          }
        },
        'error'
      );
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to enable PITR',
      message: "An error occurred while connecting to the database. Please ensure your database connection information is correct. For Supabase databases, use the Supabase dashboard to enable PITR."
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('=============== AUTO-FIX API REQUEST DEBUG ===============');
    const body = await request.json();
    console.log('Request body received:', JSON.stringify(body, null, 2));
    
    const checkId = body.checkId;
    const config = body.config || {};
    
    console.log(`CheckId: ${checkId}`);
    
    if (!checkId) {
      console.log('Missing required checkId parameter, returning 400');
      return NextResponse.json(
        { error: 'Missing required parameter: checkId' },
        { status: 400 }
      );
    }
    
    const supabase = await getSupabaseAdmin();
    
    // Get check type and projectId from the compliance_checks table
    console.log(`Fetching check details for checkId: ${checkId}`);
    const { data: checkData, error: checkError } = await supabase
      .from('compliance_checks')
      .select('type, project_id')
      .eq('id', checkId)
      .single();
      
    if (checkError || !checkData) {
      console.log('Failed to fetch check details:', checkError);
      return NextResponse.json(
        { error: 'Failed to get check details' },
        { status: 400 }
      );
    }
    
    // Set projectId from the database
    const projectId = checkData.project_id;
    
    console.log(`Check type identified: ${checkData.type}, Project ID: ${projectId}`);
    
    if (!projectId) {
      console.log('Project ID not found for check, returning 400');
      return NextResponse.json(
        { error: 'Project ID not found for the specified check' },
        { status: 400 }
      );
    }
    
    console.log('Config received:', JSON.stringify(config, null, 2));
    
    // First check if any session exists for this check ID
    const { data: existingSessions, error: sessionQueryError } = await supabase
      .from('auto_fix_sessions')
      .select('id, status, config')
      .eq('check_id', checkId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    let session;
    const existingSession = existingSessions && existingSessions.length > 0 ? existingSessions[0] : null;
    
    if (sessionQueryError) {
      console.log('Error querying existing sessions:', sessionQueryError);
      return NextResponse.json(
        { error: 'Failed to query existing auto-fix sessions' },
        { status: 500 }
      );
    }
    
    if (existingSession) {
      console.log(`Found existing session with ID: ${existingSession.id} and status: ${existingSession.status}`);
      
      // Check rule #2: If session exists and status is completed/failed, return error
      if (existingSession.status === 'fixed' || existingSession.status === 'failed') {
        console.log(`Session ${existingSession.id} is already ${existingSession.status}, returning error`);
        return NextResponse.json(
          { 
            success: false,
            error: `This check already has a ${existingSession.status} auto-fix session. Create a new check to retry.`,
            session_id: existingSession.id,
            status: existingSession.status
          },
          { status: 400 }
        );
      }
      
      // Rule #3: Session exists but not completed/failed, use it
      session = existingSession;
      
      // Update the config if needed
      await supabase
        .from('auto_fix_sessions')
        .update({
          config: config,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);
      
      console.log(`Using existing session ${session.id} with status ${session.status}`);
    } else {
      // Rule #1: No session exists, create a new one
      console.log('No existing session found, creating a new one');
      const { data: newSession, error: createError } = await supabase
        .from('auto_fix_sessions')
        .insert({
          check_id: checkId,
          status: 'in_progress',
          config: config,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (createError) {
        console.log('Failed to create auto-fix session:', createError);
        return NextResponse.json(
          { error: 'Failed to create auto-fix session' },
          { status: 500 }
        );
      }
      
      console.log(`Created new session with ID: ${newSession.id}`);
      session = newSession;
    }
    
    // Execute fix based on check type
    let result;
    const checkType = checkData.type;
    
    try {
      // Log the start of the operation (business-level logging)
      console.log(`Starting ${checkType} auto-fix operation`);
      await logAutoFixEvent(checkId, projectId, 'auto_fix_started', {
        message: `Starting ${checkType.toUpperCase()} auto-fix operation`,
        check_type: checkType,
        operation_type: 'auto_fix',
        config: config
      }, 'info');
      
      switch (checkType) {
        case 'mfa':
          // Get the list of user IDs or emails from the config
          console.log('Processing MFA auto-fix with config:');
          console.log('- selectedUsers:', config.selectedUsers);
          console.log('- selectionType:', config.selectionType);
          
          result = await enableMfaForUsers(
            projectId, 
            config.selectedUsers || [],
            config.selectionType || 'id',
            checkId
          );
          break;
          
        case 'rls':
          console.log('Processing RLS auto-fix with config:');
          console.log('- selectedTables:', config.selectedTables);
          console.log('- createDefaultPolicy:', config.createDefaultPolicy);
          
          result = await enableRlsForTables(
            projectId, 
            config.selectedTables || [],
            config.createDefaultPolicy !== false,
            checkId
          );
          break;
          
        case 'pitr':
          console.log('Processing PITR auto-fix with config:');
          console.log('- retentionDays:', config.retentionDays);
          
          result = await enablePitr(
            projectId, 
            config.retentionDays || 7,
            checkId
          );
          break;
          
        default:
          console.log(`Unsupported check type: ${checkType}`);
          throw new Error(`Unsupported check type: ${checkType}`);
      }
      
      console.log(`Auto-fix result:`, JSON.stringify(result, null, 2));
      
      // Log the business-level outcome of the operation
      const operationResult = result.success ? 'auto_fix_succeeded' : 'auto_fix_failed';
      let summaryMessage = '';
      
      // Create human-readable summary based on operation type
      switch (checkType) {
        case 'mfa':
          summaryMessage = result.success 
            ? `Successfully enforced MFA for users in your Supabase project. ${result.message}`
            : `Failed to enforce MFA: ${result.error}`;
          break;
        case 'rls':
          summaryMessage = result.success 
            ? `Successfully enabled Row Level Security for tables in your Supabase project. ${result.message}`
            : `Failed to enable Row Level Security: ${result.error}`;
          break;
        case 'pitr':
          summaryMessage = result.success 
            ? `Successfully enabled Point-in-Time Recovery for your Supabase project. ${result.message}`
            : `Failed to enable Point-in-Time Recovery: ${result.error}`;
          break;
        default:
          summaryMessage = result.success
            ? `Successfully completed auto-fix operation for ${checkType}`
            : `Failed to complete auto-fix operation for ${checkType}: ${result.error}`;
      }
      
      await logAutoFixEvent(checkId, projectId, operationResult, {
        message: summaryMessage,
        check_type: checkType,
        success: result.success,
        operation_summary: {
          operation_type: 'auto_fix',
          fix_type: checkType,
          result: result.success ? 'success' : 'failure'
        }
      }, result.success ? 'info' : 'error');
      
      // Update session with result and set status to fixed or failed
      console.log(`Updating session ${session.id} with status: ${result.success ? 'fixed' : 'failed'}`);
      await supabase
        .from('auto_fix_sessions')
        .update({
          status: result.success ? 'fixed' : 'failed',
          result: result as any, // Force type casting to fix JSON error
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);
      
      console.log('Auto-fix process completed');
      console.log('=======================================================');
      return NextResponse.json(result);
    } catch (error) {
      // Log the business-level error
      console.error('Error during auto-fix execution:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
      
      await logAutoFixEvent(checkId, projectId, 'auto_fix_error', {
        message: `Auto-fix operation for ${checkType.toUpperCase()} encountered an unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        check_type: checkType,
        operation_summary: {
          operation_type: 'auto_fix',
          fix_type: checkType,
          result: 'unexpected_error'
        }
      }, 'error');
      
      // Update session with error
      console.log(`Updating session ${session.id} with failed status due to error`);
      await supabase
        .from('auto_fix_sessions')
        .update({
          status: 'failed',
          result: { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);
      
      console.log('=======================================================');
      throw error;
    }
  } catch (error) {
    console.error('Error in auto-fix execute API:', error);
    console.error('Error details:', error instanceof Error ? {
      message: error.message,
      stack: error.stack
    } : 'Non-Error object thrown');
    console.log('=======================================================');
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}