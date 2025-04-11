import { useState, useMemo, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase-client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, ChevronRight, ListChecks, FileText, Hammer, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { AutoFix } from './auto-fix';

interface Evidence {
  id: string;
  check_id: string | null;
  type: string;
  content: string;
  severity: string;
  timestamp: string | null;
  metadata: unknown;
}

interface ComplianceCheck {
  id: string;
  type: 'mfa' | 'rls' | 'pitr';
  status: string;
  result: boolean | null;
  details: string | null;
  timestamp: string;
}

interface CheckDetailsProps {
  check: ComplianceCheck;
  isCurrentScan?: boolean;
  onUpdate?: (updatedCheck: ComplianceCheck) => void;
  compact?: boolean;
  projectId?: string;
  isLatestScan?: boolean;
  onNavigateToAutoFix?: (checkId: string) => void;
}

// Helper function to get issue description based on check type
function getIssueDescription(check: ComplianceCheck): string {
  switch(check.type) {
    case 'mfa':
      return "Some users don't have MFA enabled in Supabase.";
    case 'rls':
      return "Some tables don't have Row Level Security enabled in Supabase.";
    case 'pitr':
      return "Point in Time Recovery is not enabled for this Supabase project.";
    default:
      return "A compliance issue was detected in your Supabase project.";
  }
}

export function CheckDetails({ check: initialCheck, onUpdate, compact = false, projectId, isLatestScan = false, onNavigateToAutoFix }: CheckDetailsProps) {
  const [check, setCheck] = useState<ComplianceCheck>(initialCheck);
  const [openSection, setOpenSection] = useState<string | undefined>("logs");
  const [evidenceLogs, setEvidenceLogs] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  // Create a stable reference to the supabase client
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  
  // Store channelName in a ref to prevent recreation on re-renders
  const evidenceChannelRef = useRef<string>(`evidence-logs-${initialCheck.id}-${Date.now()}`);
  const checkChannelRef = useRef<string>(`check-updates-${initialCheck.id}`);
  
  // Add interval ref for fallback polling
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle navigation requests from parent
  useEffect(() => {
    if (onNavigateToAutoFix && 
        isLatestScan && check.result === false && check.status === 'completed') {
      // Create a handler that will open the auto-fix section when called
      const handleNavigation = (checkId: string) => {
        if (checkId === check.id) {
          setOpenSection('auto-fix');
        }
      };
      
      // Register our component's handler with the parent
      // This allows the parent to tell this component to navigate
      onNavigateToAutoFix(check.id);
      
      // We're now using props for communication, not events
    }
  }, [check.id, check.result, check.status, isLatestScan, onNavigateToAutoFix]);

  // Update local check state when prop changes
  useEffect(() => {
    setCheck(initialCheck);
  }, [initialCheck]);

  // Show auto-fix tab for all completed checks in the latest scan
  const showAutoFixTab = isLatestScan && check.status === 'completed';

  // Add this code to the useEffect section that handles navigation
  useEffect(() => {
    // Check if there's a request to open the auto-fix tab for this check
    if (typeof window !== 'undefined') {
      const openAutoFixTab = window.localStorage.getItem('openAutoFixTab');
      const openAutoFixForCheck = window.localStorage.getItem('openAutoFixForCheck');
      
      if (openAutoFixTab === 'true' && openAutoFixForCheck === check.id) {
        // Set the active section to auto-fix
        setOpenSection('auto-fix');
        
        // Clear the localStorage flags so they don't trigger again on refresh
        window.localStorage.removeItem('openAutoFixTab');
        window.localStorage.removeItem('openAutoFixForCheck');
      }
    }
  }, [check.id]);

  // Function to fetch evidence logs
  const fetchEvidenceLogs = async () => {
    console.log(`[EVIDENCE ${check.id}] Fetching evidence logs`);
    try {
      const { data, error } = await supabase
        .from('evidence')
        .select('*')
        .eq('check_id', check.id)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error(`[EVIDENCE ${check.id}] Error fetching:`, error);
        return null;
      }
      
      console.log(`[EVIDENCE ${check.id}] Fetched ${data?.length || 0} logs`);
      return data || [];
    } catch (error) {
      console.error(`[EVIDENCE ${check.id}] Error:`, error);
      return null;
    }
  };

  // Function to update evidence logs with new data
  const updateEvidenceLogs = (newLogs: Evidence[]) => {
    setEvidenceLogs(current => {
      // Create a map of existing logs by ID for quick lookup
      const existingMap = new Map(current.map(log => [log.id, log]));
      
      // Add any new logs that don't exist in our current state
      let hasNewLogs = false;
      for (const log of newLogs) {
        if (!existingMap.has(log.id)) {
          existingMap.set(log.id, log);
          hasNewLogs = true;
        }
      }
      
      if (!hasNewLogs) return current;
      
      // Convert map back to array and sort
      const combined = Array.from(existingMap.values()).sort((a, b) => {
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return aTime - bTime;
      });
      
      // Auto-scroll to bottom after a short delay
      setTimeout(() => {
        const scrollArea = document.querySelector('[data-evidence-logs] [data-radix-scroll-area-viewport]');
        if (scrollArea) {
          scrollArea.scrollTop = scrollArea.scrollHeight;
        }
      }, 100);
      
      return combined;
    });
  };

  // Fetch and subscribe to evidence logs
  useEffect(() => {
    console.log(`[EVIDENCE ${check.id}] Setting up evidence subscription`);
    let mounted = true;

    // Initial fetch
    const initialFetch = async () => {
      setLoading(true);
      try {
        const logs = await fetchEvidenceLogs();
        if (logs && mounted) {
          setEvidenceLogs(logs);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (check.id) {
      initialFetch();

      // Set up real-time subscription using the stable channel name
      const channel = supabase.channel(evidenceChannelRef.current);
      
      const subscription = channel
        .on('postgres_changes', {
          event: '*',  // Listen for all events
          schema: 'public',
          table: 'evidence',
          filter: `check_id=eq.${check.id}`,
        }, (payload: any) => {
          console.log(`[EVIDENCE ${check.id}] Change received:`, payload);
          
          if (!mounted) return;

          // Process the payload based on event type
          if (payload.eventType === 'INSERT') {
            updateEvidenceLogs([payload.new]);
          }
          
          // Update progress if this is a progress log
          if (payload.new && payload.new.type === 'progress' && payload.new.metadata) {
            try {
              const metadata = typeof payload.new.metadata === 'string' 
                ? JSON.parse(payload.new.metadata) 
                : payload.new.metadata;
              
              if (metadata && typeof metadata.progress === 'number') {
                setProgress(metadata.progress);
              }
            } catch (e) {
              console.error('Error parsing progress metadata:', e);
            }
          }
        })
        .subscribe((status) => {
          console.log(`[EVIDENCE ${check.id}] Subscription status:`, status);
          
          // If the subscription fails, fall back to polling
          if (status !== 'SUBSCRIBED') {
            console.log(`[EVIDENCE ${check.id}] Subscription failed, falling back to polling`);
            setupPolling();
          }
        });

      // Polling fallback
      const setupPolling = () => {
        // Clear any existing interval
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        
        // Set up polling interval
        pollingIntervalRef.current = setInterval(async () => {
          console.log(`[EVIDENCE ${check.id}] Polling for updates`);
          const logs = await fetchEvidenceLogs();
          if (logs && mounted) {
            updateEvidenceLogs(logs);
          }
        }, 3000); // Poll every 3 seconds
      };

      return () => {
        console.log(`[EVIDENCE ${check.id}] Cleaning up evidence subscription`);
        mounted = false;
        supabase.removeChannel(subscription);
        
        // Clear polling interval
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }
  }, [check.id]);

  // Parse details JSON if available
  const parsedDetails = useMemo(() => {
    if (!check.details) return null;
    try {
      return JSON.parse(check.details);
    } catch (e) {
      console.error('Error parsing check details:', e);
      return null;
    }
  }, [check.details]);

  // Status helpers
  const getStatusIcon = (status: boolean | null) => {
    if (status === null) return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    return status 
      ? <CheckCircle2 className="h-5 w-5 text-green-500" />
      : <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getStatusBadge = (status: boolean | null) => {
    if (status === null) return <Badge variant="outline">Unknown</Badge>;
    return status 
      ? <Badge variant="default" className="bg-green-500">Pass</Badge>
      : <Badge variant="destructive">Fail</Badge>;
  };

  // Render table based on check type
  const renderMFATable = () => {
    if (!parsedDetails) return null;
    
    const { users, total_users, users_with_mfa } = parsedDetails;
    const compliancePercentage = total_users > 0 
      ? Math.round((users_with_mfa / total_users) * 100) 
      : 0;
    
    const mfaContent = (
      <div className="space-y-4 flex flex-col h-full">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-medium">Multi-Factor Authentication Status</h3>
          <Badge 
            variant={compliancePercentage === 100 ? "default" : "destructive"} 
            className={cn(
              compliancePercentage === 100 ? "bg-green-500" : "",
              "text-xs"
            )}
          >
            {compliancePercentage}% compliant
          </Badge>
        </div>
        
        {check.result === false && (
          <Alert variant="destructive" className="mb-2">
            <AlertDescription>
              Some users don't have MFA enabled. This poses a security risk.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">User Email</TableHead>
                <TableHead className="w-[140px]">MFA Status</TableHead>
                <TableHead className="w-[140px]">Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users && users.map((user: any) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={user.mfa_enabled ? "default" : "destructive"}
                      className={user.mfa_enabled ? "bg-green-500" : ""}
                    >
                      {user.mfa_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.last_login 
                      ? new Date(user.last_login).toLocaleDateString() 
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    {!user.mfa_enabled && (
                      <div className="text-xs text-muted-foreground">
                        User needs to enable MFA
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );

    if (check.result === false && showAutoFixTab) {
      return (
        <div className="space-y-6">
          {mfaContent}
          
          <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-3 w-full">
            <div className="flex items-start">
              <Hammer className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-blue-700 dark:text-blue-300 text-sm flex-1">
                <span className="font-semibold">Auto-fix available.</span> This MFA compliance issue can be resolved automatically.
              </div>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full bg-primary/10 text-primary border-primary/20"
            onClick={() => setOpenSection("auto-fix")}
          >
            <Hammer className="h-4 w-4 mr-2" />
            Fix Compliance Issue
          </Button>
        </div>
      );
    }

    return mfaContent;
  };

  const renderRLSTable = () => {
    if (!parsedDetails) return null;
    
    const { tables, total_tables, tables_with_rls } = parsedDetails;
    const compliancePercentage = total_tables > 0 
      ? Math.round((tables_with_rls / total_tables) * 100) 
      : 0;
    
    const rlsContent = (
      <div className="space-y-4 flex flex-col h-full">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-medium">Row Level Security Status</h3>
          <Badge 
            variant={compliancePercentage === 100 ? "default" : "destructive"}
            className={cn(
              compliancePercentage === 100 ? "bg-green-500" : "",
              "text-xs"
            )}
          >
            {compliancePercentage}% compliant
          </Badge>
        </div>
        
        {check.result === false && (
          <Alert variant="destructive" className="mb-2">
            <AlertDescription>
              Some tables don't have Row Level Security enabled. This poses a security risk.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="rounded-md border overflow-hidden flex flex-col h-full">
          <div className="bg-muted/50 border-b sticky top-0 z-10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-muted/50 w-[30%]">Table Name</TableHead>
                  <TableHead className="bg-muted/50 w-[20%]">RLS Status</TableHead>
                  <TableHead className="bg-muted/50 w-[20%]">Force RLS</TableHead>
                  <TableHead className="bg-muted/50 w-[30%]">Policies</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
          </div>
          <div className="flex-1 overflow-auto">
            <Table>
              <TableBody>
                {tables && tables.map((table: any) => (
                  <TableRow key={table.id || table.name}>
                    <TableCell className="w-[30%]">{table.name}</TableCell>
                    <TableCell className="w-[20%]">
                      <div className="flex items-center gap-2">
                        {table.rls_enabled ? 
                          <CheckCircle2 className="h-4 w-4 text-green-500" /> : 
                          <XCircle className="h-4 w-4 text-red-500" />
                        }
                        <Badge 
                          variant={table.rls_enabled ? "default" : "destructive"}
                          className={table.rls_enabled ? "bg-green-500" : ""}
                        >
                          {table.rls_enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="w-[20%]">
                      <Badge variant={table.force_rls ? "default" : "secondary"}>
                        {table.force_rls ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-[30%]">
                      {table.policies?.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="policies">
                            <AccordionTrigger className="py-0">
                              <Badge variant="secondary">
                                {table.policies.length} {table.policies.length === 1 ? 'Policy' : 'Policies'}
                              </Badge>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 mt-2">
                                {table.policies.map((policy: any) => (
                                  <Card key={policy.name} className="p-2 text-sm">
                                    <p className="font-medium">{policy.name}</p>
                                    <p className="text-muted-foreground">
                                      {policy.command} - {policy.roles?.join(', ') || 'All roles'}
                                    </p>
                                  </Card>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      ) : (
                        <span className="text-muted-foreground text-sm">No policies</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    );

    if (check.result === false && showAutoFixTab) {
      return (
        <div className="space-y-6">
          {rlsContent}
          
          <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-3 w-full">
            <div className="flex items-start">
              <Hammer className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-blue-700 dark:text-blue-300 text-sm flex-1">
                <span className="font-semibold">Auto-fix available.</span> RLS can be enabled on tables that need it automatically.
              </div>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full bg-primary/10 text-primary border-primary/20"
            onClick={() => setOpenSection("auto-fix")}
          >
            <Hammer className="h-4 w-4 mr-2" />
            Fix Compliance Issue
          </Button>
        </div>
      );
    }

    return rlsContent;
  };

  const renderPITRTable = () => {
    if (!parsedDetails) return null;
    
    const { pitr_enabled, retention_period, last_backup, settings, archive_status, wal_status } = parsedDetails;
    
    const pitrContent = (
      <div className="space-y-4 flex flex-col h-full">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-medium">Point in Time Recovery Status</h3>
          <Badge 
            variant={pitr_enabled ? "default" : "destructive"}
            className={cn(
              pitr_enabled ? "bg-green-500" : "",
              "text-xs"
            )}
          >
            {pitr_enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
        
        {check.result === false && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              Point in Time Recovery is not enabled. This puts your data at risk in case of accidental deletion or corruption.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="grid gap-4 flex-1 overflow-auto">
          <Card className="p-4">
            <h4 className="text-sm font-medium mb-2">PITR Status</h4>
            <div className="flex items-center">
              {pitr_enabled 
                ? <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                : <XCircle className="h-5 w-5 text-red-500 mr-2" />
              }
              <span>{pitr_enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </Card>
          
          {wal_status && (
            <Card className="p-4">
              <h4 className="text-sm font-medium mb-2">WAL Status</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Current LSN</p>
                  <p className="font-medium">{wal_status.current_lsn || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current WAL File</p>
                  <p className="font-medium">{wal_status.current_file || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Bytes Written</p>
                  <p className="font-medium">{wal_status.bytes_written ? `${(wal_status.bytes_written / 1024 / 1024).toFixed(2)} MB` : 'N/A'}</p>
                </div>
              </div>
            </Card>
          )}
          
          {archive_status && (
            <Card className="p-4">
              <h4 className="text-sm font-medium mb-2">WAL Archiving Status</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Archived WALs</p>
                  <p className="font-medium">{archive_status.archived_count || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Failed WALs</p>
                  <p className="font-medium">{archive_status.failed_count || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Archived</p>
                  <p className="font-medium">{archive_status.last_archived || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Failed</p>
                  <p className="font-medium">{archive_status.last_failed || 'N/A'}</p>
                </div>
              </div>
            </Card>
          )}
          
          <Card className="p-4">
            <h4 className="text-sm font-medium mb-2">Retention Period</h4>
            <div className="text-sm">
              {retention_period || 'Not configured'}
            </div>
          </Card>
          
          <Card className="p-4">
            <h4 className="text-sm font-medium mb-2">Last Backup</h4>
            <div className="text-sm">
              {last_backup 
                ? new Date(last_backup).toLocaleString() 
                : 'No backups available'}
            </div>
          </Card>
          
          {settings && (
            <Card className="p-4">
              <h4 className="text-sm font-medium mb-2">Configuration</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Setting</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(settings).map(([key, setting]: [string, any]) => (
                    <TableRow key={key}>
                      <TableCell>{key}</TableCell>
                      <TableCell>{setting.value}</TableCell>
                      <TableCell>{setting.unit || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
        
        <div className="mt-4">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="recommendations">
              <AccordionTrigger className="text-sm font-medium">
                Best Practices
              </AccordionTrigger>
              <AccordionContent className="text-sm space-y-2">
                <p>For optimal data protection:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Enable Point in Time Recovery for all production projects</li>
                  <li>Set retention period based on regulatory requirements (min. 7 days recommended)</li>
                  <li>Regularly test recovery procedures</li>
                  <li>Consider additional backup strategies for critical data</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    );

    if (check.result === false && showAutoFixTab) {
      return (
        <div className="space-y-6">
          {pitrContent}
          
          <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-3 w-full">
            <div className="flex items-start">
              <Hammer className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-blue-700 dark:text-blue-300 text-sm flex-1">
                <span className="font-semibold">Auto-fix available.</span> Point-in-Time Recovery can be enabled automatically.
              </div>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full bg-primary/10 text-primary border-primary/20"
            onClick={() => setOpenSection("auto-fix")}
          >
            <Hammer className="h-4 w-4 mr-2" />
            Fix Compliance Issue
          </Button>
        </div>
      );
    }

    return pitrContent;
  };

  const renderScanProgress = () => {
    if (check.status !== 'running') return null;
    
    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Scan in progress...</span>
          <span className="text-xs font-medium">{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>
    );
  };

  const renderEvidenceLogs = () => {
    if (loading) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading evidence logs...</p>
          </div>
        </div>
      );
    }

    if (evidenceLogs.length === 0) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center max-w-[220px]">
            <div className="rounded-full bg-muted/50 p-4">
              <FileText className="h-5 w-5 text-muted-foreground opacity-70" />
            </div>
            <p className="text-sm font-medium">No evidence logs yet</p>
            <p className="text-xs text-muted-foreground">
              Evidence logs will appear here as they are collected during the scan
            </p>
          </div>
        </div>
      );
    }

    const getSeverityColor = (severity: string) => {
      switch(severity.toLowerCase()) {
        case 'critical':
        case 'error':
          return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded px-2 py-1";
        case 'high':
        case 'warning':
          return "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 rounded px-2 py-1";
        case 'medium':
          return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 rounded px-2 py-1";
        case 'low':
          return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 rounded px-2 py-1";
        case 'info':
        case 'success':
          return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 rounded px-2 py-1";
        default:
          return "text-muted-foreground bg-muted/30 rounded px-2 py-1";
      }
    };

    const getBadgeVariant = (severity: string) => {
      switch(severity.toLowerCase()) {
        case 'critical':
        case 'error':
          return "destructive";
        case 'high':
        case 'warning':
          return "outline";
        case 'medium':
          return "secondary";
        case 'low':
          return "outline";
        case 'info':
        case 'success':
          return "default";
        default:
          return "secondary";
      }
    };

    const getBadgeStyle = (severity: string) => {
      switch(severity.toLowerCase()) {
        case 'critical':
        case 'error':
          return "border-red-200 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10";
        case 'high':
        case 'warning':
          return "border-orange-200 bg-orange-50 text-orange-600 dark:bg-orange-900/10 dark:text-orange-400";
        case 'medium':
          return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
        case 'low':
          return "border-blue-200 bg-blue-50 text-blue-600 dark:bg-blue-900/10 dark:text-blue-400";
        case 'info':
        case 'success':
          return "bg-green-500 text-white dark:bg-green-600";
        default:
          return "";
      }
    };

    return (
      <ScrollArea className="h-full w-full" type="always">
        <div className="p-4 space-y-4">
          {evidenceLogs.map((log) => {
            let metadata = null;
            try {
              metadata = typeof log.metadata === 'string' 
                ? JSON.parse(log.metadata)
                : log.metadata;
            } catch (e) {
              console.error('Error parsing metadata:', e);
            }
            
            // Skip progress logs in the evidence display
            if (log.type === 'progress') return null;
            
            return (
              <Card key={log.id} className="p-3 text-sm shadow-sm">
                <div className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-0.5" />
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between">
                      <p className={getSeverityColor(log.severity)}>{log.content}</p>
                      <Badge 
                        variant={getBadgeVariant(log.severity)}
                        className={cn(getBadgeStyle(log.severity), "ml-2")}
                      >
                        {log.severity}
                      </Badge>
                    </div>
                    {metadata && (
                      <div className="text-xs bg-muted/50 p-3 rounded-md mt-2">
                        {Object.entries(metadata).map(([key, value]) => (
                          <div key={key} className="flex gap-2 mt-1">
                            <span className="font-medium min-w-[80px]">{key}:</span>
                            <span className="text-muted-foreground whitespace-pre-wrap">
                              {typeof value === 'object' 
                                ? JSON.stringify(value, null, 2)
                                : String(value)
                              }
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'No timestamp'}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    );
  };

  const renderContent = () => {
    if (compact) {
      // Simplified view for the modal
      return (
        <div className="space-y-4 h-full flex flex-col">
          {renderScanProgress()}
          <div data-evidence-logs className="flex-1 h-full">
            {renderEvidenceLogs()}
          </div>
        </div>
      );
    }
    
    // Style tabs like MFA/PITR/RLS switcher
    return (
      <Tabs 
        defaultValue={openSection}
        value={openSection} 
        onValueChange={setOpenSection}
        className="w-full h-full flex flex-col"
      >
        <div className="flex-shrink-0 pb-4">
          <TabsList className="p-1 h-9 bg-muted/50 rounded-md">
            {check.status === 'completed' && (
              <TabsTrigger 
                value="details" 
                className="flex items-center gap-1.5 h-7 px-3 text-xs font-medium data-[state=active]:bg-card"
              >
                <ListChecks className="h-3.5 w-3.5" />
                <span>Details</span>
                {parsedDetails && (
                  <Badge 
                    variant={check.result ? "default" : "destructive"} 
                    className={cn(
                      check.result ? "bg-green-500" : "",
                      "text-[10px] h-4 px-1 ml-1"
                    )}
                  >
                    {check.type === 'mfa' && `${parsedDetails.users_with_mfa || 0}/${parsedDetails.total_users}`}
                    {check.type === 'rls' && `${parsedDetails.tables_with_rls || 0}/${parsedDetails.total_tables}`}
                    {check.type === 'pitr' && (parsedDetails.pitr_enabled ? 'On' : 'Off')}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="logs" 
              className="flex items-center gap-1.5 h-7 px-3 text-xs font-medium data-[state=active]:bg-card"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Evidence Logs</span>
              {evidenceLogs.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">
                  {evidenceLogs.length}
                </Badge>
              )}
            </TabsTrigger>
            {showAutoFixTab && (
              <TabsTrigger 
                value="auto-fix" 
                className="flex items-center gap-1.5 h-7 px-3 text-xs font-medium data-[state=active]:bg-card"
              >
                <Hammer className="h-3.5 w-3.5" />
                <span>Auto-Fix</span>
                <Badge variant="outline" className="text-[10px] h-4 px-1 ml-1 bg-primary/10 text-primary border-primary/20">
                  Available
                </Badge>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {check.status === 'completed' && (
          <TabsContent 
            value="details" 
            className="flex-1 h-full border-none m-0 p-0 data-[state=inactive]:hidden overflow-hidden"
          >
            <ScrollArea className="h-full w-full" type="always">
              <div className="p-4">
                {check.type === 'mfa' && renderMFATable()}
                {check.type === 'rls' && renderRLSTable()}
                {check.type === 'pitr' && renderPITRTable()}
              </div>
            </ScrollArea>
          </TabsContent>
        )}

        <TabsContent 
          value="logs" 
          className="flex-1 h-full border-none m-0 p-0 data-[state=inactive]:hidden overflow-hidden"
        >
          <div className="h-full flex flex-col">
            <div className="flex-shrink-0 px-1 pb-3">
              {renderScanProgress()}
            </div>
            <div data-evidence-logs className="flex-1 h-full min-h-0">
              {renderEvidenceLogs()}
            </div>
          </div>
        </TabsContent>
        
        {showAutoFixTab && (
          <TabsContent 
            value="auto-fix" 
            className="flex-1 h-full border-none m-0 p-0 data-[state=inactive]:hidden overflow-hidden"
          >
            <ScrollArea className="h-full w-full" type="always">
              <div className="p-4">
                <div className="space-y-6">
                  {check.result === true ? (
                    <>
                      <Alert className="bg-green-500/10 border-green-200 text-green-600">
                        <div className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          <AlertDescription>
                            <span className="font-medium">All good!</span> This {check.type.toUpperCase()} compliance check is already passing.
                          </AlertDescription>
                        </div>
                      </Alert>
                      
                      <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:bg-green-900/20">
                        <h3 className="text-sm font-medium mb-2 text-green-700 dark:text-green-300">Best Practices</h3>
                        {check.type === 'mfa' && (
                          <ul className="text-sm space-y-2 text-muted-foreground ml-5 list-disc">
                            <li>Ensure all users enable MFA for their accounts</li>
                            <li>Regularly review user accounts without MFA</li>
                            <li>Consider making MFA mandatory for all users</li>
                          </ul>
                        )}
                        {check.type === 'rls' && (
                          <ul className="text-sm space-y-2 text-muted-foreground ml-5 list-disc">
                            <li>Regularly review RLS policies for all tables</li>
                            <li>Test RLS policies to ensure they work as expected</li>
                            <li>Add RLS to any new tables that are created</li>
                          </ul>
                        )}
                        {check.type === 'pitr' && (
                          <ul className="text-sm space-y-2 text-muted-foreground ml-5 list-disc">
                            <li>Verify the retention period matches your requirements</li>
                            <li>Test the recovery process periodically</li>
                            <li>Monitor the PITR logs for any failures</li>
                          </ul>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <Alert className="bg-muted/50">
                        <AlertDescription className="text-sm">
                          Automatically fix compliance issues related to {check.type.toUpperCase()} configuration.
                          The suggested fixes will help bring your Supabase project into compliance.
                        </AlertDescription>
                      </Alert>
                      
                      <AutoFix
                        checkId={check.id}
                        checkType={check.type}
                        projectId={projectId || ''}
                        className="mb-4"
                        onFixApplied={(success) => {
                          if (success) {
                            // In a real app, we would trigger a refresh of the check
                            console.log('Fix applied successfully');
                          }
                        }}
                        onFixVerified={(success) => {
                          if (success) {
                            // In a real app, we would trigger a refresh of the check
                            console.log('Fix verified successfully');
                          }
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        )}
      </Tabs>
    );
  };

  return (
    <div className={cn("space-y-1 h-full flex flex-col overflow-hidden", compact ? "" : "bg-muted/50 rounded-lg p-3")}>
      {!compact && (
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            {getStatusIcon(check.result)}
            <h3 className="text-sm font-medium capitalize">{check.type} Check</h3>
          </div>
          <Badge 
            variant={
              check.status === 'running' 
                ? 'secondary' 
                : check.status === 'completed' 
                  ? (check.result ? 'default' : 'destructive')
                  : 'secondary'
            }
            className={cn(
              check.status === 'running' ? 'animate-pulse' : '',
              check.status === 'completed' && check.result ? 'bg-green-500' : ''
            )}
          >
            {check.status === 'completed' ? (check.result ? 'Pass' : 'Fail') : check.status}
          </Badge>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
} 