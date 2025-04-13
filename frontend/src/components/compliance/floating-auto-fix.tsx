'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Hammer, 
  ChevronUp,
  ChevronDown,
  CheckCircle2, 
  XCircle, 
  Loader2,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScanGroup {
  timestamp: string;
  checks: {
    id: string;
    type: 'mfa' | 'rls' | 'pitr';
    status: string;
    result: boolean | null;
  }[];
  status: 'running' | 'completed' | 'failed';
}

interface FloatingAutoFixProps {
  scan: ScanGroup;
  projectId: string;
  onSelectCheck: (checkId: string) => void;
  onNavigateToAutoFix?: (checkId: string) => void;
  className?: string;
}

export function FloatingAutoFix({ scan, projectId, onSelectCheck, onNavigateToAutoFix, className }: FloatingAutoFixProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Get the count of failing checks in the scan
  const failingChecksCount = scan.checks.filter(c => c.status === 'completed' && c.result === false).length;
  
  // Get the count of passing checks in the scan
  const passingChecksCount = scan.checks.filter(c => c.status === 'completed' && c.result === true).length;
  
  // Button style based on check status
  const getButtonVariant = () => {
    if (failingChecksCount > 0) return "destructive";
    if (passingChecksCount > 0) return "outline";
    return "secondary";
  };
  
  const getButtonText = () => {
    if (failingChecksCount > 0) return "Fix Issues";
    if (passingChecksCount > 0) return "All Compliant";
    return "No Results";
  };
  
  // Toggle dropdown visibility
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };
  
  return (
    <div className="relative inline-block">
      <Button
        variant={getButtonVariant()}
        size="sm" 
        className={cn(
          "mr-3 h-9 gap-1.5",
          failingChecksCount > 0 && "hover:bg-destructive/90",
          className
        )}
        onClick={toggleDropdown}
      >
        <Hammer className="h-3.5 w-3.5" />
        <span>{getButtonText()}</span>
        {failingChecksCount > 0 && (
          <Badge variant="outline" className="bg-white text-destructive border-none font-semibold ml-1 h-5 text-xs">
            {failingChecksCount}
          </Badge>
        )}
      </Button>
      
      {isOpen && (
        <Card className="absolute right-0 mt-2 w-[300px] overflow-hidden z-50 shadow-lg animate-in fade-in-0 zoom-in-95 py-0 gap-0">
          <div className={cn(
            "p-3 flex items-center gap-2",
            failingChecksCount > 0 
              ? "bg-destructive/10 text-destructive border-b border-destructive/20" 
              : passingChecksCount === scan.checks.length && scan.checks.length > 0
                ? "bg-green-500/10 text-green-600 dark:text-green-400 border-b border-green-500/20"
                : "bg-primary/10 text-primary border-b border-primary/20"
          )}>
            <Shield className="h-4 w-4" />
            <h3 className="text-sm font-medium">Compliance Status</h3>
          </div>
          
          <CardContent className="p-2 max-h-[50vh] overflow-y-auto">
            <div className="space-y-2">
              {/* Order checks in a predictable way for better UX - same order as main tab */}
              {['mfa', 'rls', 'pitr'].map(type => {
                const check = scan.checks.find(c => c.type === type);
                if (!check) return null;
                
                return (
                  <Button
                    key={check.id}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full flex items-center justify-between text-left h-auto py-2",
                      check.status === 'completed' && check.result === false 
                        ? "border-red-200 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20" 
                        : check.status === 'completed' && check.result === true
                          ? "border-green-200 bg-green-50 hover:bg-green-100 dark:bg-green-900/10 dark:hover:bg-green-900/20"
                          : "border-blue-200 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/10 dark:hover:bg-blue-900/20"
                    )}
                    onClick={() => {
                      // Just select the check - navigating to auto-fix section handled by parent
                      onSelectCheck(check.id);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {check.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                      {check.status === 'completed' && check.result === true && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {check.status === 'completed' && check.result === false && <XCircle className="h-4 w-4 text-red-500" />}
                      <div>
                        <div className="font-medium capitalize">
                          {check.type === 'mfa' ? 'Multi-Factor Authentication' :
                           check.type === 'rls' ? 'Row Level Security' :
                           'Point in Time Recovery'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {check.status === 'running' && 'Check in progress...'}
                          {check.status === 'completed' && check.result === true && 'All good! No issues found.'}
                          {check.status === 'completed' && check.result === false && 'Issues detected. Click to fix.'}
                        </div>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 