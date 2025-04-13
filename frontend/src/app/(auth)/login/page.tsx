'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";

// Inner component that uses useSearchParams
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('registered')) {
      toast({
        title: 'Registration successful!',
        description: 'Please check your email to verify your account.'
      });
    }
  }, [searchParams, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    console.log("handleLogin : ", email, password);

    try {
      const { error } = await signIn(email, password);
      if (error) throw error;
      
      toast({
        title: 'Welcome back!',
        description: 'Successfully logged in.'
      });
      
      router.push('/dashboard');
    } catch (err: any) {
      console.log("error : ", err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to sign in',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome Back</CardTitle>
        <CardDescription>Sign in to your account to continue</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-gray-600">
          Don't have an account?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

// Loading fallback for Suspense
function LoginFallback() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome Back</CardTitle>
        <CardDescription>Loading...</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-10 bg-gray-200 animate-pulse rounded-md"></div>
          <div className="h-10 bg-gray-200 animate-pulse rounded-md"></div>
          <div className="h-10 bg-gray-200 animate-pulse rounded-md"></div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
} 