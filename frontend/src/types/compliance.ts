export interface TableMetadata {
  has_rls: boolean;
  row_count?: number;
  schema: string;
  name: string;
}

export interface ComplianceCheck {
  id: string;
  project_id: string;
  scan_id: string;
  type: 'mfa' | 'rls' | 'pitr';
  status: 'pending' | 'running' | 'passed' | 'failed';
  details?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface ScanResult {
  id: string;
  project_id: string;
  status: 'pending' | 'running' | 'completed';
  created_at?: string;
  updated_at?: string;
  checks?: ComplianceCheck[];
} 