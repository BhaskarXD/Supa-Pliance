import { NextResponse } from 'next/server';
import { runComplianceChecks } from '../lib/check-runner';
import { createServerSupabaseClient } from '@/utils/supabase-admin';

export async function POST(request: Request) {
  try {
    const { projectId } = await request.json();
    console.log("Starting scan for project ID:", projectId);

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Create server client with auth cookies
    const supabase = await createServerSupabaseClient();
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log("Auth check:", { userId: user?.id, error: authError });
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Try to get the project - will only return if user has access
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId);
    
    console.log("Project query result:", { 
      userId: user.id,
      projectId,
      count: projects?.length, 
      error: projectsError 
    });
      
    // Check if we found any projects
    if (projectsError || !projects || projects.length === 0) {
      return NextResponse.json(
        { error: 'Project not found or you don\'t have access' },
        { status: 404 }
      );
    }

    // Use the first project we found
    const project = projects[0] as any;
    console.log("Found project:", project.id, project.name);

    // Update project status to running
    await supabase
      .from('projects')
      .update({ 
        status: 'running',
        last_scan_at: new Date().toISOString()
      })
      .eq('id', projectId);
    
    // Create a new scan record
    const { data: scanData, error: scanError } = await supabase
      .from('scans')
      .insert({
        project_id: projectId,
        status: 'running',
        started_at: new Date().toISOString(),
        summary: {
          total_checks: 0,
          passed_checks: 0,
          failed_checks: 0
        }
      })
      .select()
      .single();
      
    if (scanError) {
      console.error('Error creating scan record:', scanError);
      return NextResponse.json(
        { error: 'Failed to create scan record' },
        { status: 500 }
      );
    }
    
    const scanId = scanData.id;
    console.log("Created scan record:", scanId);
    
    // Create compliance checks entries
    const checkTypes = ['mfa', 'rls', 'pitr'];
    const enabledChecks = project.enabled_checks;
    
    // Only create checks for enabled types
    const checksToRun = checkTypes.filter(type => 
      enabledChecks && enabledChecks[type] === true
    );
    
    // Start all enabled checks
    const checkPromises = checksToRun.map(async (type) => {
      // Insert check record with running status
      try {
        const { data: check, error: insertError } = await supabase
          .from('compliance_checks')
          .insert({
            project_id: projectId,
            scan_id: scanId, // Associate with the scan
            type,
            status: 'running',
            details: `Starting ${type.toUpperCase()} compliance check...`
          })
          .select()
          .single();
          
        if (insertError) {
          console.error(`Error creating ${type} check:`, insertError);
          return null;
        } else {
          console.log("Check created:", check?.id, type);
        }
        
        return check;
      } catch (error) {
        console.error(`Error creating ${type} check:`, error);
        return null;
      }
    });
    
    const checks = await Promise.all(checkPromises);
    
    // Update the scan summary with the number of checks
    await supabase
      .from('scans')
      .update({
        summary: {
          total_checks: checks.filter(Boolean).length,
          passed_checks: 0,
          failed_checks: 0
        }
      })
      .eq('id', scanId);
    
    // Run compliance checks in background
    if (!project.service_key || !project.supabase_url) {
      console.error("Missing required properties:", { 
        hasServiceKey: !!project.service_key,
        hasSupabaseUrl: !!project.supabase_url 
      });
      return NextResponse.json(
        { error: 'Project is missing required properties' },
        { status: 400 }
      );
    }
    
    runComplianceChecks(
      projectId, 
      project.service_key,
      project.supabase_url,
      scanId  // Pass the scanId to the check runner
    ).catch(error => {
      console.error('Error running compliance checks:', error);
    });
    
    // Return success response immediately
    return NextResponse.json({ 
      success: true, 
      message: 'Compliance scan started',
      scanId // Return the scanId in the response
    });
    
  } catch (error) {
    console.error('Error starting compliance scan:', error);
    return NextResponse.json(
      { error: 'Failed to start compliance scan' },
      { status: 500 }
    );
  }
} 