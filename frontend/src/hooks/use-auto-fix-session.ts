import { useState, useCallback } from "react";
import { AutoFixSession } from "@/types";

export function useAutoFixSession(checkId: string, projectId: string) {
  const [session, setSession] = useState<AutoFixSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing session
  const fetchSession = useCallback(async () => {
    if (!checkId) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/auto-fix/session?checkId=${checkId}`);
      
      if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to fetch session: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSession(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch session");
      return null;
    } finally {
      setLoading(false);
    }
  }, [checkId]);

  // Create a new session
  const createSession = useCallback(async (config = {}) => {
    if (!checkId) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/auto-fix/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          check_id: checkId,
          config
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }

      const data = await response.json();
      setSession(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
      return null;
    } finally {
      setLoading(false);
    }
  }, [checkId]);

  // Execute a fix
  const executeAutoFix = useCallback(async (config: any) => {
    if (!checkId || !projectId) {
      return { success: false, error: 'Missing check ID or project ID' };
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Call the execute API
      const response = await fetch(`/api/auto-fix/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkId,
          projectId,
          config
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute auto-fix');
      }

      const result = await response.json();
      
      // Refresh session state after execution
      await fetchSession();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute auto-fix');
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to execute auto-fix'
      };
    } finally {
      setLoading(false);
    }
  }, [checkId, projectId, fetchSession]);

  return {
    session,
    loading,
    error,
    fetchSession,
    createSession,
    executeAutoFix
  };
}