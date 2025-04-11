import type { Database } from './supabase';

// Table types
export type Tables = Database['public']['Tables'];

// Row types (for fetching data)
export type UserRow = Tables['users']['Row'];
export type ComplianceCheckRow = Tables['compliance_checks']['Row'];
export type EvidenceRow = Tables['evidence']['Row'];

// Insert types (for creating new records)
export type UserInsert = Tables['users']['Insert'];
export type ComplianceCheckInsert = Tables['compliance_checks']['Insert'];
export type EvidenceInsert = Tables['evidence']['Insert'];

// Update types (for modifying existing records)
export type UserUpdate = Tables['users']['Update'];
export type ComplianceCheckUpdate = Tables['compliance_checks']['Update'];
export type EvidenceUpdate = Tables['evidence']['Update']; 