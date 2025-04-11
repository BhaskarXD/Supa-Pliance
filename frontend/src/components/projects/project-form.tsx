'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const enabledChecksSchema = z.object({
  mfa: z.boolean(),
  rls: z.boolean(),
  pitr: z.boolean(),
});

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  supabase_url: z.string().url('Must be a valid URL').min(1, 'Supabase URL is required'),
  service_key: z.string().min(1, 'Service role key is required'),
  db_connection_string: z.string().min(1, 'Database connection string is required'),
  enabled_checks: enabledChecksSchema,
});

type FormData = z.infer<typeof projectSchema>;

interface ProjectFormProps {
  initialData?: Partial<FormData>;
}

export function ProjectForm({ initialData }: ProjectFormProps) {
  const router = useRouter();
  
  const defaultValues: FormData = {
    name: initialData?.name ?? '',
    supabase_url: initialData?.supabase_url ?? '',
    service_key: initialData?.service_key ?? '',
    db_connection_string: initialData?.db_connection_string ?? '',
    enabled_checks: initialData?.enabled_checks ?? {
      mfa: true,
      rls: true,
      pitr: true,
    },
  };

  const form = useForm<FormData>({
    resolver: zodResolver(projectSchema),
    defaultValues,
  });

  async function onSubmit(values: FormData) {
    try {
      console.log("Submitting project form values:", values);
      
      // Use the correct API endpoint in /api/projects/new
      const response = await fetch('/api/projects/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          supabase_url: values.supabase_url,
          service_key: values.service_key,
          db_connection_string: values.db_connection_string,
          enabled_checks: values.enabled_checks,
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to add project');
      }

      toast.success('Project added successfully');
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      console.error('Project creation error:', error);
      toast.error('Failed to add project');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name</FormLabel>
              <FormControl>
                <Input placeholder="My Supabase Project" {...field} />
              </FormControl>
              <FormDescription>
                A friendly name to identify your project
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="supabase_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Supabase URL</FormLabel>
              <FormControl>
                <Input placeholder="https://your-project-ref.supabase.co" {...field} />
              </FormControl>
              <FormDescription>
                The URL of your Supabase project (Project Settings {'->'} API {'->'} Project URL)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="service_key"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Service Role Key</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Your project&apos;s service role key (Project Settings {'->'} API {'->'} service_role key)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="db_connection_string"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Database Connection String</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Your database connection string (Project Settings {'->'} Database {'->'} Connection string)
                <br />
                Make sure to replace [YOUR-PASSWORD] with your database password
                <br />
                The connection string must have sufficient access to connect to and modify the users database.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">
          {initialData ? 'Update Project' : 'Add Project'}
        </Button>
      </form>
    </Form>
  );
} 