import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

export async function POST(request: Request) {
  try {
    // Get request body
    const body = await request.json();
    const { name, supabase_url, service_key, db_connection_string, enabled_checks } = body;
    
    // Initialize Supabase client
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Validate required fields
    if (!name || !supabase_url || !service_key) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Insert project
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        supabase_url,
        service_key,
        db_connection_string,
        enabled_checks,
        user_id: user.id,
        status: 'active',
      })
      .select();
    
    if (error) {
      console.error('Project creation error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    // Return the created project
    return NextResponse.json({
      project: data[0],
      message: 'Project created successfully'
    });
    
  } catch (error) {
    console.error('Error in project creation:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
} 