import { useState, useEffect } from 'react';

interface MfaDetails {
  project_enabled: boolean;
  enforce_for_all: boolean;
}

export function useMfaDetails(projectId: string, enabled: boolean) {
  const [mfaDetails, setMfaDetails] = useState<MfaDetails | undefined>(undefined);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const fetchMfaDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/projects/${projectId}/mfa`);
        if (!response.ok) {
          throw new Error(`Failed to fetch MFA details: ${response.status}`);
        }
        const data = await response.json();
        setMfaDetails(data);
      } catch (error) {
        console.error('Error fetching MFA details:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch MFA details');
      } finally {
        setLoading(false);
      }
    };

    fetchMfaDetails();
  }, [projectId, enabled]);

  const updateMfaDetails = (details: MfaDetails) => {
    setMfaDetails(details);
  };

  return { mfaDetails, updateMfaDetails, loading, error };
} 