import { ProjectForm } from '@/components/projects/project-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewProjectPage() {
  return (
    <div className="container max-w-2xl h-[calc(100vh-8rem)] flex items-center justify-center">
      <Card>
        <CardHeader>
          <CardTitle>Add New Project</CardTitle>
          <CardDescription>
            Connect a Supabase project to start monitoring its compliance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectForm />
        </CardContent>
      </Card>
    </div>
  );
} 