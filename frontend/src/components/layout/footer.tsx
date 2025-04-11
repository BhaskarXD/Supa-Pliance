'use client';

import { usePathname } from 'next/navigation';

export function Footer() {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');

  if (!isAuthPage) return null;

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-16 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container h-full">
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Supa-pliance. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
} 