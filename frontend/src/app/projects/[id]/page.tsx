'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { PostgrestError } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckDetails } from '@/components/compliance/check-details';
import { 
  Loader2, 
  PlayCircle, 
  Clock, 
  Calendar,
  CheckCircle2, 
  XCircle, 
  History,
  BarChart4
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { ScanDrawer } from '@/components/compliance/scan-drawer';
import { AIChat } from '@/components/compliance/ai-chat';
import { FloatingAutoFix } from '@/components/compliance/floating-auto-fix';
import { log } from 'console';


interface Project {
  id: string;
  name: string;
  db_connection_string: string | null;
  last_scan_at: string | null;
  service_key: string;
  supabase_url: string;
  enabled_checks: string[];
  status: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface ComplianceCheck {
  id: string;
  project_id: string;
  scan_id: string | null;
  type: 'mfa' | 'rls' | 'pitr';
  status: string;
  result: boolean | null;
  details: string | null;
  timestamp: string;
}

interface ScanGroup {
  id: string;
  project_id: string;
  timestamp: string;
  started_at: string;
  completed_at: string | null;
  checks: ComplianceCheck[];
  status: 'running' | 'completed' | 'failed';
  summary?: {
    total_checks: number;
    passed_checks: number;
    failed_checks: number;
  };
}

export default function ProjectPage() {
  const params = useParams();
  const projectId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [project, setProject] = useState<Project | null>(null);
  const [scans, setScans] = useState<ScanGroup[]>([]);
  const [activeScan, setActiveScan] = useState<ScanGroup | null>(null);
  const [scanDrawerOpen, setScanDrawerOpen] = useState(false);
  const [selectedScan, setSelectedScan] = useState<string | null>(null);
  const [selectedCheckType, setSelectedCheckType] = useState<'mfa' | 'rls' | 'pitr' | null>(null);
  const [checkOpenSections, setCheckOpenSections] = useState<Record<string, string>>({
    'mfa': 'logs',
    'rls': 'logs',
    'pitr': 'logs'
  });
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    if (!projectId) return;

    loadProjectAndChecks();
    
    // Subscribe to both new checks and updates
    const channel = supabase.channel('compliance-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'compliance_checks',
        filter: `project_id=eq.${projectId}`,
      }, (payload: any) => {
        console.log('New check:', payload.new);
        const newCheck = normalizeCheck(payload.new);
        handleCheckUpdate(newCheck);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'compliance_checks',
        filter: `project_id=eq.${projectId}`,
      }, (payload: any) => {
        console.log('Updated check:', payload.new);
        const updatedCheck = normalizeCheck(payload.new);
        handleCheckUpdate(updatedCheck);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  useEffect(() => {
    const runningScan = scans.find(s => s.status === 'running');
    
    setActiveScan(runningScan || null);
    
    if (runningScan) {
      setScanDrawerOpen(true);
      setIsScanning(true);
    } else {
      setIsScanning(false);
    }
    
    // Auto-select most recent scan if none selected
    if (!selectedScan && scans.length > 0) {
      setSelectedScan(scans[0].id);
      
      // Auto-select the first check type if available
      const firstScan = scans[0];
      if (firstScan && firstScan.checks.length > 0) {
        setSelectedCheckType(firstScan.checks[0].type);
      }
    }
  }, [scans, selectedScan]);

  // Helper function to normalize check data
  const normalizeCheck = (check: any): ComplianceCheck => {
    return {
      id: check.id,
      project_id: check.project_id,
      scan_id: check.scan_id,
      type: check.type as 'mfa' | 'rls' | 'pitr',
      status: check.status,
      result: check.result,
      details: check.details,
      timestamp: check.timestamp
    };
  };

  const handleCheckUpdate = (check: ComplianceCheck) => {
    console.log('Handling check update:', check);
    
    setScans(prevScans => {
      // Look for the scan that this check belongs to by scan_id
      if (!check.scan_id) {
        console.error('Check has no scan_id, cannot update:', check);
        return prevScans;
      }
      
      const scanIndex = prevScans.findIndex(s => s.id === check.scan_id);

      if (scanIndex === -1) {
        // Create new scan group if we have a scan_id but no matching scan
        console.log('Creating new scan group for scan_id:', check.scan_id);
        
        // Create a new scan record
        const newScanGroup: ScanGroup = {
          id: check.scan_id,
          project_id: check.project_id,
          timestamp: check.timestamp,
          started_at: check.timestamp,
          completed_at: null,
          checks: [check],
          status: check.status === 'completed' ? 'completed' : 'running',
          summary: {
            total_checks: 1,
            passed_checks: check.result === true ? 1 : 0,
            failed_checks: check.result === false ? 1 : 0
          }
        };
        setSelectedScan(check.scan_id);
        
        return [newScanGroup, ...prevScans];
      }

      // Update existing scan by scan_id
      const updatedScans = [...prevScans];
      const scanGroup = {...updatedScans[scanIndex]};
      const checkIndex = scanGroup.checks.findIndex(c => c.type === check.type);

      if (checkIndex === -1) {
        scanGroup.checks.push(check);
      } else {
        scanGroup.checks[checkIndex] = check;
      }

      // Update scan group status based on its checks
      scanGroup.status = scanGroup.checks.every(c => c.status === 'completed')
        ? (scanGroup.checks.some(c => !c.result) ? 'failed' : 'completed')
        : 'running';
      
      // Update summary data
      const passedChecks = scanGroup.checks.filter(c => c.result === true).length;
      const failedChecks = scanGroup.checks.filter(c => c.result === false).length;
      
      scanGroup.summary = {
        total_checks: scanGroup.checks.length,
        passed_checks: passedChecks,
        failed_checks: failedChecks
      };

      updatedScans[scanIndex] = scanGroup;
      return updatedScans;
    });
  };

  const loadProjectAndChecks = async () => {
    if (!projectId) return;

    try {
      setIsLoading(true);
      console.log('Loading project:', projectId);

      // First, get the project details
      const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) {
        console.error('Error fetching project:', projectError);
        if (projectError.code === 'PGRST116') {
          setProject(null);
          return;
        }
        throw projectError;
      }

      setProject(projectData as Project);

      // Get scans for this project
      const { data: scansData, error: scansError } = await supabase
        .from('scans')
        .select('*')
        .eq('project_id', projectId)
        .order('started_at', { ascending: false });

      if (scansError) {
        console.error('Error fetching scans:', scansError);
        throw scansError;
      }

      // Then, get all compliance checks for this project
      const { data: checksData, error: checksError } = await supabase
          .from('compliance_checks')
          .select('*')
        .eq('project_id', projectId)
        .order('timestamp', { ascending: false });

      if (checksError) {
        console.error('Error fetching checks:', checksError);
        throw checksError;
      }

      // Process scans with their checks
      const scanGroups = (scansData || []).map(scan => {
        // Find all checks for this scan
        const scanChecks = (checksData || [])
          .filter(check => check.scan_id === scan.id)
          .map(check => normalizeCheck(check));

        return {
          id: scan.id,
          project_id: scan.project_id,
          timestamp: scan.started_at,
          started_at: scan.started_at,
          completed_at: scan.completed_at,
          checks: scanChecks,
          status: scan.status as 'running' | 'completed' | 'failed',
          summary: scan.summary
        } as ScanGroup;
      });

      setScans(scanGroups);
      
      // Auto-select the most recent scan
      if (scanGroups.length > 0) {
        setSelectedScan(scanGroups[0].id);
        // Auto-select the first check type if available
        if (scanGroups[0].checks.length > 0) {
          setSelectedCheckType(scanGroups[0].checks[0].type);
        }
      }
    } catch (error) {
      console.error('Error in loadProjectAndChecks:', error);
      if (error instanceof PostgrestError) {
        toast.error(error.message);
      } else {
        toast.error('Failed to load project details');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const startScan = async () => {
    if (!projectId) return;

    try {
      setIsScanning(true);
      const response = await fetch('/api/compliance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        throw new Error('Failed to start scan');
      }

      toast.success('Scan started successfully');
    } catch (error) {
      console.error('Error starting scan:', error);
      toast.error('Failed to start scan');
    }
  };

  // Sort checks in a consistent order: MFA -> RLS -> PITR
  const sortChecks = (checks: ComplianceCheck[]) => {
    const orderMap = { mfa: 0, rls: 1, pitr: 2 };
    return [...checks].sort((a, b) => orderMap[a.type] - orderMap[b.type]);
  };

  const renderTimeline = () => {
    if (scans.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
          <div className="flex flex-col items-center gap-3 opacity-80">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
              <PlayCircle className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-muted-foreground">Run your first scan to see history</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        <ScrollArea className="flex-1 overflow-auto" scrollHideDelay={0} type="always">
          <div className="divide-y divide-border/30">
            {scans.map((scan) => {
              const isSelected = selectedScan === scan.id;
              const passedChecks = scan.checks.filter(c => c.result === true).length;
              const sortedChecks = sortChecks(scan.checks);
              
              return (
                <div 
                  key={scan.id}
                  className={cn(
                    "py-2 px-4 cursor-pointer transition-all hover:bg-accent/30",
                    isSelected ? "bg-accent/40 border-l-4 !border-l-white" : ""
                  )}
                  onClick={() => {
                    console.log(`Selecting scan: ${scan.id}`);
                    setSelectedScan(scan.id);
                    if (scan.checks.length > 0) {
                      setSelectedCheckType(scan.checks[0].type);
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        scan.status === 'running' ? "bg-blue-500 animate-pulse" : 
                        scan.status === 'completed' ? 
                          (passedChecks === scan.checks.length ? "bg-green-500" : "bg-red-500") : 
                          "bg-yellow-500"
                      )} />
                      <span className="text-xs font-medium">
                        {new Date(scan.timestamp).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {new Date(scan.timestamp).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {sortedChecks.map((check) => (
                      <div 
                        key={check.id}
                        className={cn(
                          "flex items-center justify-center py-1.5 rounded-md text-[11px] font-medium transition-all",
                          check.status === 'running' ? "text-blue-500 bg-blue-500/10" : "",
                          check.status === 'completed' && check.result ? "text-green-600 dark:text-green-400 bg-green-500/10" : "",
                          check.status === 'completed' && !check.result ? "text-red-600 dark:text-red-400 bg-red-500/10" : "",
                          selectedCheckType === check.type && isSelected ? "ring-1 ring-primary/50" : ""
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log(`Selecting scan: ${scan.id} and check type: ${check.type}`);
                          setSelectedScan(scan.id);
                          setSelectedCheckType(check.type);
                        }}
                      >
                        {check.status === 'running' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        {check.status === 'completed' && check.result && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {check.status === 'completed' && !check.result && <XCircle className="h-3 w-3 mr-1" />}
                        <span className="capitalize">{check.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderScanDetails = () => {
    if (!selectedScan) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center bg-gradient-to-br from-muted/20 to-background">
          <div className="flex flex-col items-center gap-3 max-w-[200px]">
            <div className="rounded-full bg-muted/50 p-4">
              <BarChart4 className="h-8 w-8 text-muted-foreground opacity-70" strokeWidth={1.25} />
            </div>
            <p className="text-sm font-medium">No scan selected</p>
            <p className="text-xs text-muted-foreground">
              Select a scan from the history panel to view detailed results
            </p>
          </div>
        </div>
      );
    }

    const scan = scans.find(s => s.id === selectedScan);
    if (!scan) return null;
    
    const sortedChecks = sortChecks(scan.checks);
    const selectedCheck = scan.checks.find(c => c.type === selectedCheckType) || sortedChecks[0];
    const scanDate = new Date(scan.timestamp);
    const isLatestScan = scans.length > 0 && scans[0].id === selectedScan;

    return (
      <div className="h-full flex flex-col">
        {/* Header with scan info */}
        <div className="py-1 px-3 border-b flex items-center justify-between">
          <div className="flex items-center">
            <h2 className="text-sm font-medium flex items-center gap-1.5 py-2">
              {scan.status === 'running' && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
              {scan.status === 'completed' && scan.checks.every(c => c.result) && <div className="w-2 h-2 rounded-full bg-green-500" />}
              {scan.status === 'completed' && !scan.checks.every(c => c.result) && <div className="w-2 h-2 rounded-full bg-red-500" />}
              Scan Results
              {isLatestScan && <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">Latest</Badge>}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3 mr-1" /> 
              {scanDate.toLocaleDateString(undefined, {month: 'long', day: 'numeric', year: 'numeric'})}
              <span className="mx-1">•</span>
              <Clock className="h-3 w-3 mr-1" />
              {scanDate.toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit', timeZoneName: 'short'})}
            </div>
            <div className="text-xs">
              {scan.status === 'running' && 
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 animate-pulse">Running</Badge>
              }
              {scan.status === 'completed' && scan.checks.every(c => c.result) && 
                <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800">Passed</Badge>
              }
              {scan.status === 'completed' && !scan.checks.every(c => c.result) && 
                <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800">Failed</Badge>
              }
            </div>
          </div>
        </div>

        {/* Use Tabs component for full-width tabs */}
        <Tabs 
          defaultValue={selectedCheck?.type || "mfa"} 
          value={selectedCheckType || undefined}
          onValueChange={(value: string) => setSelectedCheckType(value as 'mfa' | 'rls' | 'pitr')}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="w-full grid grid-cols-3 rounded-none border-b bg-transparent h-10">
            {sortedChecks.map((check) => (
              <TabsTrigger 
                key={check.type} 
                value={check.type} 
                className={cn(
                  "relative h-10 rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary",
                  check.status === 'running' ? "text-blue-500" : 
                    check.status === 'completed' && check.result ? "data-[state=active]:text-green-600" : 
                    check.status === 'completed' && !check.result ? "data-[state=active]:text-red-600" : ""
                )}
              >
                <div className="flex items-center space-x-1.5">
                  {check.status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {check.status === 'completed' && check.result && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                  {check.status === 'completed' && !check.result && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                  <span className="capitalize">{check.type}</span>
                </div>
                {check.status === 'running' && (
                  <motion.div 
                    className="absolute bottom-0 left-0 h-0.5 bg-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {/* Tab content that maximizes available height */}
          {sortedChecks.map((check) => (
            <TabsContent 
              key={check.type} 
              value={check.type}
              className="flex-1 p-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col h-full"
            >
              <div className="p-3 flex-1 overflow-auto h-full">
                <CheckDetails 
                  check={check} 
                  projectId={typeof params.id === 'string' ? params.id : params.id[0]}
                  isLatestScan={isLatestScan}
                  openSection={checkOpenSections[check.type]}
                  onSectionChange={(section: string) => {
                    setCheckOpenSections(prev => ({
                      ...prev,
                      [check.type]: section
                    }));
                  }}
                  onUpdate={(updatedCheck) => {
                    // Ensure we pass all required fields including scan_id
                    const completeCheck: ComplianceCheck = {
                      ...updatedCheck,
                      project_id: projectId,
                      scan_id: check.scan_id // Preserve the scan_id 
                    };
                    handleCheckUpdate(completeCheck);
                  }}
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading project details...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
        <p className="text-muted-foreground">The requested project could not be found.</p>
      </div>
    );
  }

  return (
    <>
      <ScanDrawer
        scan={activeScan}
        isOpen={scanDrawerOpen}
        onClose={() => {
          setScanDrawerOpen(false);
          
          if (activeScan) {
            setSelectedScan(activeScan.id);
            if (activeScan.checks.length > 0) {
              setSelectedCheckType(activeScan.checks[0].type);
            }
          }
        }}
        projectName={project?.name || ""}
      />
      
      <div className="container mx-auto py-6 h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        {/* Project Header */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-2xl font-bold leading-none tracking-tight">{project.name}</h1>
              {project.last_scan_at && (
                <p className="text-sm text-muted-foreground mt-1.5 flex items-center">
                  <Clock className="h-3.5 w-3.5 mr-1.5 inline" />
                  Last scan: {formatDate(project.last_scan_at)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {(activeScan || scans.length > 0) && (
              <FloatingAutoFix 
                scan={activeScan || scans[0]} 
                projectId={projectId}
                onSelectCheck={(checkId: string) => {
                  for (const scan of scans) {
                    const check = scan.checks.find(c => c.id === checkId);
                    if (check) {
                      setSelectedScan(scan.id);
                      setSelectedCheckType(check.type);
                      
                      // Only set auto-fix section for failing checks in the latest scan
                      const isLatestScan = scans.length > 0 && scans[0].id === scan.id;
                      const shouldShowAutoFix = isLatestScan && 
                                              check.status === 'completed' && 
                                              check.result === false;
                      
                      if (shouldShowAutoFix) {
                        // Navigate to auto-fix section if available
                        setCheckOpenSections(prev => ({
                          ...prev,
                          [check.type]: 'auto-fix'
                        }));
                      } else {
                        // Otherwise default to details or logs
                        setCheckOpenSections(prev => ({
                          ...prev,
                          [check.type]: check.status === 'completed' ? 'details' : 'logs'
                        }));
                      }
                      break;
                    }
                  }
                }}
              />
            )}
            <Button 
              onClick={startScan} 
              disabled={isScanning || scans.some(s => s.status === 'running')}
              className="flex items-center gap-2 h-10 px-4 shadow-sm hover:shadow transition-shadow"
              size="default"
              variant="default"
            >
              {isScanning || scans.some(s => s.status === 'running') ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Scanning</span>
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" />
                  <span>Start Scan</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Content layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 overflow-hidden">
          {/* History panel */}
          <Card className="md:col-span-3 gap-0 flex flex-col overflow-hidden shadow-md border bg-card/50 py-0">
            <CardHeader className="py-3 px-4 flex-shrink-0 border-b bg-muted/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Scan History</CardTitle>
                <History className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              {renderTimeline()}
            </CardContent>
          </Card>

          {/* Details panel */}
          <Card className="md:col-span-9 flex flex-col overflow-hidden shadow-md border bg-card/50 py-0">
            <CardContent className="p-0 h-full overflow-hidden">
              {renderScanDetails()}
            </CardContent>
          </Card>
        </div>
      </div>

      <AIChat
        projectName={project?.name}
        checkType={selectedCheckType ?? undefined}
        checkStatus={selectedScan ? scans.find(s => s.id === selectedScan)?.status : undefined}
        checkResult={selectedScan ? scans.find(s => s.id === selectedScan)?.checks.some(c => c.type === selectedCheckType && c.result) ?? false : false}
        currentScan={selectedScan ? scans.find(s => s.id === selectedScan) : undefined}
        scanHistory={scans.slice(0, 5)}
      />
    </>
  );
} 