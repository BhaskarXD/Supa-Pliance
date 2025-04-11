import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
import { randomUUID } from 'crypto';

// GET handler to fetch an auto-fix session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const checkId = searchParams.get('checkId');
    
    if (!checkId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    const supabase = await getSupabaseAdmin();
    const { data: session, error } = await supabase
      .from('auto_fix_sessions')
      .select('*')
      .eq('check_id', checkId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      // If no session found, return null rather than an error
      if (error.code === 'PGRST116') {
        return NextResponse.json(null);
      }
      
      console.error('Error fetching auto-fix session:', error);
      return NextResponse.json(
        { error: 'Failed to fetch auto-fix session' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(session);
  } catch (error) {
    console.error('Error in GET /api/auto-fix/session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST handler to create a new auto-fix session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { check_id, config } = body;
    
    if (!check_id) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    const sessionId = randomUUID();
    
    const supabase = await getSupabaseAdmin();
    
    // Create a new session
    const { data: session, error } = await supabase
      .from('auto_fix_sessions')
      .insert({
        id: sessionId,
        check_id,
        config,
        status: 'not_started',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating auto-fix session:', error);
      return NextResponse.json(
        { error: 'Failed to create auto-fix session' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(session);
  } catch (error) {
    console.error('Error in POST /api/auto-fix/session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 