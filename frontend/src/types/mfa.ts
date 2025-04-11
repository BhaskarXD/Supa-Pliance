export interface MfaDetails {
  isEnabled: boolean;
  isMandatory: boolean;
  totalUsers: number;
  enabledUsers: number;
  percentageEnabled: number;
  enabled?: boolean;
  mandatory?: boolean;
  userStats?: {
    total: number;
    withMfa: number;
    percentage: number;
  };
  enforce_for_all?: boolean;
  fix_phase?: 'project' | 'user' | 'complete';
  project_enabled?: boolean;
  user_factors_enabled?: boolean;
}

export interface MfaFixConfig {
  enforceMfa: boolean;
}

export interface UserMfaDetail {
  id: string;
  email: string;
  hasMfa: boolean;
} 