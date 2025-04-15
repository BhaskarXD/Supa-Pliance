'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, XCircle, AlertCircle, Play } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useComplianceUpdates } from '@/hooks/use-compliance-updates';

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    last_scan_at: string | null;
    status: string;
    compliance_checks: Array<{
      id: string;
      type: string;
      status: string;
      result: boolean | null;
      timestamp: string | null;
    }>;
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const [isScanning, setIsScanning] = useState(false);
  const router = useRouter();

  // Subscribe to real-time updates
  useComplianceUpdates(project.id);

  const startScan = async () => {
    try {
      setIsScanning(true);
      console.log("Starting scan for project:", project.id, project.name);
      
      const response = await fetch('/api/compliance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id })
      });
      
      const result = await response.json();
      console.log("Scan API response:", result);
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to start scan');
      }
      
      toast.success('Scan completed successfully');
      router.refresh();
    } catch (error: any) {
      console.error("Scan error:", error);
      toast.error('Failed to start scan: ' + error.message);
    } finally {
      setIsScanning(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/15 text-green-700 dark:text-green-400';
      case 'failed':
        return 'bg-red-500/15 text-red-700 dark:text-red-400';
      case 'running':
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-400';
      default:
        return 'bg-gray-500/15 text-gray-700 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string, result: boolean | null) => {
    if (status !== 'completed') return <AlertCircle className="h-4 w-4" />;
    return result ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  // Group checks by timestamp to find the latest scan
  const latestChecks = project.compliance_checks
    .reduce((acc, check) => {
      const timestamp = check.timestamp?.split('.')[0] || '';
      if (!acc[timestamp]) {
        acc[timestamp] = [];
      }
      acc[timestamp].push(check);
      return acc;
    }, {} as Record<string, typeof project.compliance_checks>);

  // Get the most recent timestamp
  const latestTimestamp = Object.keys(latestChecks).sort().reverse()[0];
  const latestScanChecks = latestChecks[latestTimestamp] || [];

  // Calculate scan status
  const allCompleted = latestScanChecks.every(c => c.status === 'completed');
  const anyFailed = latestScanChecks.some(c => c.status === 'completed' && !c.result);
  const anyRunning = latestScanChecks.some(c => c.status === 'running');
  
  const scanStatus = anyRunning ? 'running' : allCompleted ? (anyFailed ? 'failed' : 'completed') : 'pending';
  const isRunning = scanStatus === 'running';

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="truncate">{project.name}</span>
          <Badge variant="outline" className={getStatusColor(scanStatus)}>
            {scanStatus}
          </Badge>
        </CardTitle>
        <CardDescription className="truncate">
          Last scan: {project.last_scan_at ? new Date(project.last_scan_at).toLocaleString() : 'Never'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 space-y-2">
          {latestScanChecks.map((check) => (
            <div
              key={check.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="capitalize">{check.type} Check</span>
              {getStatusIcon(check.status, check.result)}
            </div>
          ))}
          {latestScanChecks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No checks run yet
            </p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {latestScanChecks.length} check{latestScanChecks.length !== 1 ? 's' : ''} in latest scan
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={startScan}
              disabled={isScanning || isRunning}
            >
              <Play className="mr-2 h-4 w-4" />
              {isScanning ? 'Starting...' : 'Scan Now'}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/projects/${project.id}`}>
                View Details
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 