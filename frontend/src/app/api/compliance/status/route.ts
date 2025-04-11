import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/utils/supabase-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const checkId = searchParams.get('checkId');
  
  if (!checkId) {
    return NextResponse.json({ error: "checkId is required" }, { status: 400 });
  }
  
  try {
    const supabase = await getSupabaseAdmin();
    // Fetch the compliance check
    const { data, error } = await supabase
      .from('compliance_checks')
      .select('id, type, status, result, details')
      .eq('id', checkId)
      .single();
    
    if (error) {
      console.error('Error fetching compliance check:', error);
      return NextResponse.json({ error: 'Failed to fetch compliance check' }, { status: 500 });
    }
    
    if (!data) {
      return NextResponse.json({ error: 'Compliance check not found' }, { status: 404 });
    }
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error checking compliance status:', error);
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    );
  }
} 