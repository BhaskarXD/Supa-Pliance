'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AutoFixContent } from './AutoFixContent';
import { toast } from 'sonner';

export function AutoFix({
  checkType,
  projectId
}: {
  checkType: 'mfa' | 'rls' | 'pitr';
  projectId: string;
}) {
  const [isRunning, setIsRunning] = useState(false);
  const router = useRouter();

  const handleExecute = async (config: any) => {
    setIsRunning(true);
    try {
      const res = await fetch(`/api/autofix/${checkType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          ...config,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to apply fix');
      }

      toast.success(`${checkType.toUpperCase()} settings have been successfully updated.`);

      // Refresh compliance data after applying fixes
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to apply fix');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <AutoFixContent
      checkType={checkType}
      projectId={projectId}
      isRunning={isRunning}
      onExecute={handleExecute}
    />
  );
} 