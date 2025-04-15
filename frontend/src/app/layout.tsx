import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from 'sonner';
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import "./globals.css";
import { AuthProvider } from '@/contexts/auth-context';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Supa-pliance - Supabase Configuration Compliance",
  description: "Monitor and manage your Supabase configuration compliance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <div className="min-h-screen flex flex-col">
              <Header />
              <div className="flex-1 mt-16">
                {children}
              </div>
              <Footer />
            </div>
            <Toaster 
              position="top-right"
              toastOptions={{
                className: 'border border-border shadow-md rounded-lg',
                style: { 
                  background: 'hsl(var(--primary-foreground))', 
                  color: 'hsl(var(--primary))',
                  fontSize: '14px',
                },
                duration: 4000,
              }}
              closeButton={false}
              richColors
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
