'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Hammer, Loader2, AlertCircle } from 'lucide-react';
import { AutoFixContent } from './auto-fix/AutoFixContent';
import { useAutoFixSession } from '@/hooks/use-auto-fix-session';
import { toast } from 'sonner';

interface AutoFixProps {
  checkId: string;
  checkType: 'mfa' | 'rls' | 'pitr';
  projectId: string;
  initialStatus?: boolean;
  onFixApplied?: (success: boolean) => void;
  onFixVerified?: (success: boolean) => void;
  className?: string;
}

export function AutoFix({ 
  checkId, 
  checkType, 
  projectId,
  initialStatus = false,
  onFixApplied,
  onFixVerified,
  className 
}: AutoFixProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkDetails, setCheckDetails] = useState<any>(null);
  
  // Use auto-fix session hook
  const { session, loading: sessionLoading, error: sessionError, fetchSession, executeAutoFix } = useAutoFixSession(checkId, projectId);

  // Load session data on mount
  useEffect(() => {
    fetchSession();
    // Get check details including users or tables
    const fetchCheckDetails = async () => {
      try {
        // Use the correct endpoint with query parameter format
        const response = await fetch(`/api/compliance/status?checkId=${checkId}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Fetched check details:', data);
          
          // Store the check details with proper typing for the check type
          setCheckDetails({
            ...data,
            type: checkType // Ensure type is set correctly
          });
        } else {
          console.error('Failed to fetch check details, status:', response.status);
          setError('Failed to fetch compliance check details');
        }
      } catch (err) {
        console.error('Error fetching check details', err);
        setError('Error retrieving compliance data');
      }
    };
    
    fetchCheckDetails();
  }, [fetchSession, checkId, checkType]);

  const handleExecute = async (config: any) => {
    setIsRunning(true);
    setError(null);

    try {
      const result = await executeAutoFix(config);
      
      if (result.success) {
        toast.success(`${checkType.toUpperCase()} settings have been successfully updated.`);
        if (onFixApplied) onFixApplied(true);
        if (onFixVerified) onFixVerified(true);
      } else {
        toast.error(result.error || 'Failed to apply fix');
        if (onFixApplied) onFixApplied(false);
        if (onFixVerified) onFixVerified(false);
        setError(result.error || 'Failed to apply fix');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast.error(errorMessage);
      if (onFixApplied) onFixApplied(false);
      if (onFixVerified) onFixVerified(false);
      setError(errorMessage);
    } finally {
      setIsRunning(false);
    }
  };

  // Determine if we're loading data
  const isLoading = sessionLoading || !checkDetails;

  // Check if the check is already passing based on initial status
  const isPassing = initialStatus === true;

  // Check if fix has been applied successfully
  const isFixed = session?.status === 'fixed';

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Hammer className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-medium">Auto-Fix</CardTitle>
        </div>
        <CardDescription>
          Fix compliance issues with a single click
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPassing && (
          <Alert className="mb-4 bg-green-500/10 border-green-200 text-green-600">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            <AlertDescription>
              Good news! This {checkType.toUpperCase()} check is already passing. No fixes needed.
            </AlertDescription>
          </Alert>
        )}
        
        {isFixed && (
          <Alert className="mb-4 bg-green-500/10 border-green-200 text-green-600">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            <AlertDescription>
              Auto-fix successfully applied! Your configuration is now compliant.
            </AlertDescription>
          </Alert>
        )}
        
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isPassing && !isFixed && isLoading && (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading...</span>
          </div>
        )}

        {!isPassing && !isFixed && !isLoading && session?.status === 'in_progress' && (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Auto-fix in progress...</span>
          </div>
        )}

        {!isPassing && !isFixed && !isLoading && session?.status !== 'in_progress' && (
          <AutoFixContent
            checkType={checkType}
            projectId={projectId}
            checkDetails={checkDetails}
            isRunning={isRunning}
            onExecute={handleExecute}
          />
        )}
      </CardContent>
    </Card>
  );
}