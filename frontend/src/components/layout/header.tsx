'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/contexts/auth-context';

interface HeaderProps {
  variant?: 'default' | 'auth';
}

export function Header({ variant = 'default' }: HeaderProps) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
  const { user, signOut, loading } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container h-full">
        <div className="flex h-full items-center justify-between gap-4">
          <Link href="/" className="flex-none text-2xl font-bold">
            Supa-pliance
          </Link>

          <div className="flex items-center gap-6">
            <nav className="hidden items-center gap-6 md:flex">
              <Link href="/" className="text-sm font-medium transition-colors hover:text-foreground/80">
                Home
              </Link>
              {user && (
                <Link href="/dashboard" className="text-sm font-medium transition-colors hover:text-foreground/80">
                  Dashboard
                </Link>
              )}
            </nav>

            {variant === 'default' && !isAuthPage && !loading && (
              <div className="flex items-center gap-4">
                {user ? (
                  <Button variant="outline" onClick={() => signOut()}>
                    Sign Out
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" asChild>
                      <Link href="/login">Sign In</Link>
                    </Button>
                    <Button asChild>
                      <Link href="/register">Get Started</Link>
                    </Button>
                  </>
                )}
              </div>
            )}
            
            <div className="border-l pl-6">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
} 