// User Types
export interface User {
  id: string;
  email: string;
  mfa_enabled: boolean;
  last_login: string;
}

// Compliance Check Types
export interface ComplianceCheck {
  id: string;
  type: 'mfa' | 'rls' | 'pitr';
  status: 'pending' | 'running' | 'completed' | 'failed';
  result: boolean;
  details: string;
  timestamp: string;
  evidence: Evidence[];
}

export interface Evidence {
  id: string;
  check_id: string;
  type: string;
  content: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error';
  metadata?: Record<string, any>;
}

// Table Types
export interface Table {
  id: string;
  name: string;
  rls_enabled: boolean;
  policies: RLSPolicy[];
  row_count?: number;
  description?: string;
}

export interface RLSPolicy {
  id: string;
  table_id: string;
  name: string;
  definition: string;
  enabled: boolean;
}

// Project Types
export interface Project {
  id: string;
  name: string;
  pitr_enabled: boolean;
  backup_frequency: string;
  retention_period: string;
}

// AI Chat Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AutoFixSuggestion {
  id: string;
  check_id: string;
  description: string;
  command: string;
  impact: string;
  status: 'pending' | 'applied' | 'failed';
}

// Auto-Fix Config Types
export interface RlsFixConfig {
  selectedTables: string[];
  tableMetadata: Record<string, {
    row_count: number;
    has_rls: boolean;
    description?: string;
  }>;
}

export interface MfaFixConfig {
  enforceForAllUsers: boolean;
  projectLevelFixed: boolean;
  userStats?: {
    totalUsers: number;
    usersWithMfa: number;
  };
}

export interface PitrFixConfig {
  retentionPeriod: number;
  estimatedCost?: number;
}

// Auto-Fix Session Type for persistence
export interface AutoFixSession {
  id: string;
  check_id: string;
  status: 'not_started' | 'in_progress' | 'fixed' | 'failed';
  config?: any;
  result?: any;
  created_at?: string;
  updated_at?: string;
}

export interface AutoFixMetadata {
  projectId: string;
  checkId: string;
  selectedTables?: string[];
  retentionPeriod?: number;
  enforceMfa?: boolean;
}

export interface AutoFixContentProps {
  checkId: string;
  projectId: string;
  onExecute: () => void;
  isRunning: boolean;
  error?: string;
  session?: AutoFixSession;
}

export interface TableMetadata {
  has_rls: boolean;
  schema: string;
  name: string;
  row_count?: number;
}

// WebSocket Types
export interface WebSocketMessage {
  type: 'compliance_update' | 'check_progress' | 'auto_fix_status' | 'chat_message';
  payload: any;
  timestamp: string;
}

// Define the possible fix phases - keeping for backward compatibility but not used in new workflow
export type FixPhase = 'not_started' | 'project_level' | 'project_level_complete' | 'user_level' | 'complete';

export interface AutoFixResult {
  success: boolean;
  message?: string;
  error?: string;
  fix_phase?: FixPhase;
  details?: any;
} 