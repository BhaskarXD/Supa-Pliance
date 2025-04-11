import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, AlertCircle, Loader2, ArrowDown, ArrowDownUp } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import { CheckDetails } from '@/components/compliance/check-details';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";

// Helper function to format dates from UTC timestamps
const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  
  // Create a date object from the UTC database timestamp
  // JavaScript automatically converts to the user's local timezone
  const date = new Date(dateString);
  
  // Format using the user's locale settings with timezone info
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });
};

interface ComplianceCheck {
  id: string;
  type: 'mfa' | 'rls' | 'pitr';
  status: string;
  result: boolean | null;
  details: string | null;
  timestamp: string;
}

interface ScanGroup {
  timestamp: string;
  status: string;
  checks: ComplianceCheck[];
}

interface ScanDrawerProps {
  scan: ScanGroup | null;
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
}

export function ScanDrawer({ scan, isOpen, onClose, projectName }: ScanDrawerProps) {
  const [logsRef] = useAutoAnimate();
  const [currentCheckIndex, setCurrentCheckIndex] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scan) return;
    
    // Find the current running check
    const runningCheckIndex = scan.checks.findIndex(check => check.status === 'running');
    if (runningCheckIndex >= 0) {
      setCurrentCheckIndex(runningCheckIndex);
    } else {
      // If no running check, use the number of completed checks
      setCurrentCheckIndex(scan.checks.filter(check => check.status === 'completed').length);
    }
  }, [scan]);

  // Function to check if all checks are passing now
  const areAllChecksPassing = useCallback(() => {
    if (!scan) return false;
    
    // Check if all checks are completed and passing
    return scan.checks.every(check => 
      check.status === 'completed' && check.result === true
    );
  }, [scan]);

  // Auto-close the drawer when all checks pass
  useEffect(() => {
    if (isOpen && areAllChecksPassing()) {
      // Give a short delay to show the success state before closing
      const timer = setTimeout(() => {
        toast.success("All compliance checks are now passing!");
        onClose();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, scan, areAllChecksPassing, onClose]);

  // Handle auto-scrolling
  useEffect(() => {
    if (!autoScroll || !scrollContainerRef.current || !scan) return;
    
    const scrollToBottom = () => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    };
    
    // Small timeout to let content render first
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [autoScroll, scan?.checks.length, scan?.checks.map(c => c.status).join()]);

  if (!scan) return null;

  const completedChecks = scan.checks.filter(c => c.status === 'completed').length;
  const totalChecks = scan.checks.length;
  const progress = (completedChecks / totalChecks) * 100;

  // Order checks in a predictable way for better UX
  const checkTypes = ['mfa', 'rls', 'pitr'];
  const orderedChecks = checkTypes
    .map(type => scan.checks.find(check => check.type === type))
    .filter(Boolean) as ComplianceCheck[];
  
  const checkTypeLabels = {
    mfa: 'Multi-Factor Authentication',
    rls: 'Row Level Security',
    pitr: 'Point in Time Recovery'
  };

  const getCheckStage = (type: string) => {
    const check = orderedChecks.find(c => c.type === type);
    if (!check) return 'pending';
    if (check.status === 'completed') return check.result ? 'passed' : 'failed';
    return check.status;
  };

  const runningCheck = orderedChecks.find(c => c.status === 'running');

  // Simple scroll handler for detecting when user manually scrolls
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    // Only update state if needed to avoid unnecessary re-renders
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    } else if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl p-0 border-l-0 gap-0 flex flex-col">
        <SheetHeader className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-xl">Scanning Project: {projectName}</SheetTitle>
              <p className="text-sm text-muted-foreground">
                Started {formatDate(scan.timestamp)}
              </p>
            </div>
            <Badge variant="secondary" className="animate-pulse">
              {Math.round(progress)}% Complete
            </Badge>
          </div>
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
          </div>
        </SheetHeader>

        {/* Magical scan journey */}
        <div className="px-6 py-4 border-b">
          <div className="relative flex items-center justify-between mb-2">
            {/* Progress line */}
            <div className="absolute left-0 right-0 h-1 bg-muted top-1/2 -translate-y-1/2 z-0">
              <motion.div 
                className="h-full bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: `${Math.max(0, (currentCheckIndex / (checkTypes.length - 1)) * 100)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            
            {/* Check stages */}
            {checkTypes.map((type, index) => {
              const stage = getCheckStage(type);
              const isActive = orderedChecks.find(c => c.type === type)?.status === 'running';
              
              return (
                <div key={type} className="z-10 flex flex-col items-center">
                  <motion.div 
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 mb-2 relative",
                      isActive ? "ring-4 ring-blue-300/50" : "",
                      stage === 'pending' ? "border-muted-foreground bg-background" : 
                        stage === 'running' ? "border-blue-500 bg-blue-100 dark:bg-blue-950" : 
                        stage === 'passed' ? "border-green-500 bg-green-100 dark:bg-green-950" : 
                        "border-red-500 bg-red-100 dark:bg-red-950"
                    )}
                    animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    {stage === 'pending' && <AlertCircle className="h-5 w-5 text-muted-foreground" />}
                    {stage === 'running' && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
                    {stage === 'passed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    {stage === 'failed' && <XCircle className="h-5 w-5 text-red-500" />}
                  </motion.div>
                  <span className={cn(
                    "text-sm font-medium",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}>
                    {checkTypeLabels[type as keyof typeof checkTypeLabels]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Active check details */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div 
              key={runningCheck?.id || 'waiting'}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col"
            >
              {runningCheck ? (
                <>
                  <div className="p-6 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium flex items-center">
                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin mr-2" />
                        Scanning: {checkTypeLabels[runningCheck.type as keyof typeof checkTypeLabels]}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Evidence logs appear in real-time as they're collected
                      </p>
                    </div>
                    
                    {/* Auto-scroll toggle */}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setAutoScroll(!autoScroll)}
                      className={cn(
                        "px-2 h-8",
                        autoScroll ? "text-blue-500" : "text-muted-foreground"
                      )}
                    >
                      {autoScroll ? (
                        <>
                          <ArrowDown className="h-3.5 w-3.5 mr-1" />
                          <span className="text-xs">Auto-scroll</span>
                        </>
                      ) : (
                        <>
                          <ArrowDownUp className="h-3.5 w-3.5 mr-1" />
                          <span className="text-xs">Manual scroll</span>
                        </>
                      )}
                    </Button>
                  </div>
                  
                  <ScrollArea 
                    className="flex-1 px-6 pb-6"
                    onScrollCapture={handleScroll}
                    scrollHideDelay={400}
                    ref={scrollContainerRef as any}
                  >
                    <div ref={logsRef} className="space-y-3">
                      <CheckDetails 
                        key={runningCheck.id} 
                        check={runningCheck}
                        compact={true}
                      />
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="p-6 h-full flex flex-col items-center justify-center">
                  <div className="text-center max-w-md">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" />
                    <h3 className="text-lg font-medium">Preparing scan...</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      We're getting everything ready to scan your project
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Footer with summary & controls */}
        <div className="border-t p-4 flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            <span>{completedChecks} of {totalChecks} checks completed</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
} 