import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export function useComplianceUpdates(projectId: string) {
  const router = useRouter();

  useEffect(() => {
    // Subscribe to compliance_checks changes
    const checksSubscription = supabase
      .channel(`compliance_checks:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'compliance_checks',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          // Refresh the page data when checks are updated
          router.refresh();
        }
      )
      .subscribe();

    // Subscribe to project status changes
    const projectSubscription = supabase
      .channel(`project:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`,
        },
        () => {
          // Refresh the page data when project status changes
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      checksSubscription.unsubscribe();
      projectSubscription.unsubscribe();
    };
  }, [projectId, router]);
} 