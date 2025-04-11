'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Project {
  id: string;
  name: string;
  status: string;
  last_scan_at: string | null;
  supabase_url: string;
  service_key: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  db_connection_string: string | null;
  enabled_checks: {
    mfa?: boolean;
    rls?: boolean;
    pitr?: boolean;
  } | any;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProjects() {
      setLoading(true);
      setError(null);
      
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setProjects(data || []);
      } catch (error) {
        console.error('Error loading projects:', error);
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Failed to load projects. Please try again.';
        
        setError(errorMessage);
        toast.error('Failed to load projects', {
          description: errorMessage,
        });
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, []);

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground">
            Manage and monitor your Supabase projects
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Project
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse bg-gradient-to-br from-card to-card/80 border border-border/50 shadow-sm">
              <CardHeader>
                <div className="h-6 w-2/3 bg-muted/50 rounded" />
                <div className="h-4 w-1/2 bg-muted/50 rounded mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full bg-muted/50 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/10 border-red-200 dark:border-red-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">Error Loading Projects</CardTitle>
            <CardDescription className="text-red-600/80 dark:text-red-400/80">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => window.location.reload()}
              className="bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : projects.length === 0 ? (
        <Card className="bg-gradient-to-br from-card to-card/80 border border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">No projects yet</CardTitle>
            <CardDescription>
              Add your first Supabase project to start monitoring compliance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/projects/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Project
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="group relative overflow-hidden bg-gradient-to-br from-background to-muted/50 border border-border/50 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:from-background/90 hover:to-muted/70">
                <CardHeader className="pb-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold tracking-tight">{project.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5 line-clamp-1">{project.supabase_url}</CardDescription>
                    </div>
                    <div className={`h-2.5 w-2.5 rounded-full ${getStatusColor(project.status)}`} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium capitalize">{project.status}</span>
                  </div>
                  {project.last_scan_at && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Last Scan</span>
                      <span className="font-medium">
                        {new Date(project.last_scan_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1.5 border-t border-border/50">
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-0.5">Enabled Checks</div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(project.enabled_checks || {}).map(([check, enabled]) => {
                          if (enabled) {
                            return (
                              <span 
                                key={check}
                                className="px-1.5 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary"
                              >
                                {check.toUpperCase()}
                              </span>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-500';
    case 'running':
      return 'bg-blue-500';
    case 'completed':
      return 'bg-green-500';
    case 'failed':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
} 