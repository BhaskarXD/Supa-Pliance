import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
import { cookies } from 'next/headers';

// Define types for session data
interface AutoFixSession {
  id: string;
  check_id: string;
  project_id: string;
  config: Record<string, any>;
  results?: Record<string, any>;
  suggestions?: Record<string, any>;
  status: string;
  created_at: string;
  updated_at: string;
}

// PATCH handler to update specific fields of an auto-fix session
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
    }
    
    const requestData = await request.json();
    const { suggestions, config, status, results } = requestData;
    
    const supabase = await getSupabaseAdmin();
    
    // First, get the current session data to merge with updates
    const { data: currentSession, error: fetchError } = await supabase
      .from('auto_fix_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching current session:', fetchError.message);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    
    if (!currentSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    // Build update object with merged data
    const updateData: Record<string, any> = {};
    
    if (suggestions) {
      updateData.suggestions = suggestions;
    }
    
    if (config) {
      // Merge with existing config if present
      updateData.config = {
        ...(currentSession.config as Record<string, any> || {}),
        ...config
      };
    }
    
    if (status) {
      updateData.status = status;
    }
    
    if (results) {
      // Get the check type from the compliance_checks table using check_id
      const { data: checkData, error: checkError } = await supabase
        .from('compliance_checks')
        .select('type')
        .eq('id', currentSession.check_id)
        .single();
        
      if (checkError) {
        console.error('Error fetching check type:', checkError);
      }
      
      // For MFA checks, we want to preserve phase information
      if (checkData?.type === 'mfa' && currentSession.result) {
        const currentResults = currentSession.result as Record<string, any>;
        const newResults = results as Record<string, any>;
        
        // If we're moving from project_level to user_level, nest the current results
        if (
          newResults.fix_phase === 'user_level' && 
          (!currentResults.fix_phase || currentResults.fix_phase === 'project_level')
        ) {
          updateData.result = {
            ...newResults,
            project_level: currentResults
          };
        } else {
          // Otherwise merge the results
          updateData.result = {
            ...currentResults,
            ...newResults
          };
        }
      } else {
        updateData.result = results;
      }
    }
    
    // Update the session
    const { data, error } = await supabase
      .from('auto_fix_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select();
    
    if (error) {
      console.error('Error updating auto-fix session:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data[0]);
  } catch (error) {
    console.error('Error in PATCH auto-fix session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// DELETE handler to remove an auto-fix session
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
    }
    
    const supabase = await getSupabaseAdmin();
    
    const { error } = await supabase
      .from('auto_fix_sessions')
      .delete()
      .eq('id', sessionId);
    
    if (error) {
      console.error('Error deleting auto-fix session:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE auto-fix session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 