import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface EvidenceLog {
  id: string;
  check_id: string;
  type: string;
  content: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: string;
}

interface EvidenceLogsProps {
  checkId: string;
}

export function EvidenceLogs({ checkId }: EvidenceLogsProps) {
  const [logs, setLogs] = useState<EvidenceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadLogs();

    // Set up real-time subscription for new logs
    const subscription = supabase
      .channel('evidence-logs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'evidence',
        filter: `check_id=eq.${checkId}`,
      }, (payload) => {
        // Add the new log to the existing logs
        setLogs((currentLogs) => [...currentLogs, payload.new as EvidenceLog]);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [checkId]);

  async function loadLogs() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('evidence')
        .select('*')
        .eq('check_id', checkId)
        .order('timestamp', { ascending: true });

      console.log('Loaded logs:', data);
      if (error) {
        throw error;
      }

      setLogs(data as EvidenceLog[]);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load evidence logs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'secondary';
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-4 bg-muted rounded w-3/4"></div>
        <div className="h-4 bg-muted rounded w-1/2"></div>
        <div className="h-4 bg-muted rounded w-2/3"></div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No evidence logs found for this check.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px] rounded-md border p-4">
      <div className="space-y-4">
        {logs.map((log) => (
          <div key={log.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <Badge variant={getSeverityColor(log.severity) as any} className="capitalize">
                {log.severity}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(log.timestamp).toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  timeZoneName: 'short'
                })}
              </span>
            </div>
            <p className="text-sm">{log.content}</p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
} 