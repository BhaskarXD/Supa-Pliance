import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle, Shield, LockKeyhole, Activity, Database, Server } from 'lucide-react';

export default function Home() {
  return (
    <main className="home-content overflow-hidden">
      {/* Hero Section */}
      <section className="relative w-full py-28 md:py-36 overflow-hidden">
        {/* Background Gradient Effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-background"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        
        <div className="container relative z-10">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center px-3 py-1 mb-6 text-sm font-medium rounded-full bg-primary/10 text-primary">
              <Shield className="w-4 h-4 mr-2" />
              Enterprise-Grade Security for Supabase
            </div>
            
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-500">
              Secure Your Supabase Configuration
            </h1>
            
            <p className="mt-6 text-xl text-muted-foreground max-w-2xl">
              Automatically scan and verify your Supabase setup for security best practices. 
              Monitor MFA, RLS, and PITR configurations with real-time compliance insights.
            </p>
            
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Button size="lg" className="rounded-full text-base px-8 shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5">
                <Link href="/register" className="flex items-center">
                  Start Free Scan <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full text-base px-8">
                <Link href="/login">View Dashboard</Link>
              </Button>
            </div>
            
            <div className="mt-10 flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium border-2 border-background">
                  <img src="https://ui-avatars.com/api/?name=Google&background=4285F4&color=fff" alt="Google" className="w-full h-full rounded-full" />
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-medium border-2 border-background">
                  <img src="https://ui-avatars.com/api/?name=Amazon&background=2E7D32&color=fff" alt="Amazon" className="w-full h-full rounded-full" />
                </div>
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-medium border-2 border-background">
                  <img src="https://ui-avatars.com/api/?name=Stripe&background=F59E0B&color=fff" alt="Stripe" className="w-full h-full rounded-full" />
                </div>
              </div>
              <span>Trusted by 300+ Supabase projects</span>
            </div>
          </div>
          
          {/* Hero Image/Dashboard Preview */}
          <div className="relative mt-16 mx-auto max-w-5xl">
            <div className="aspect-[16/9] rounded-xl overflow-hidden border shadow-2xl shadow-primary/10 bg-background">
              <div className="w-full h-full bg-gradient-to-tr from-slate-50 to-primary/5 dark:from-slate-900 dark:to-primary/10 flex items-center justify-center">
                <div className="w-4/5 h-4/5 relative bg-background/80 backdrop-blur-sm rounded-lg border p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex space-x-1">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="h-5 w-32 bg-muted rounded-md"></div>
                  </div>
                  <div className="flex-1 grid grid-cols-4 gap-3">
                    <div className="col-span-1 bg-muted/60 rounded-md"></div>
                    <div className="col-span-3 grid grid-cols-3 gap-2">
                      <div className="col-span-3 h-8 bg-primary/10 rounded-md"></div>
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className="h-16 bg-muted/40 rounded-md"></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Floating Elements */}
            <div className="absolute -right-6 top-1/4 bg-green-500/90 text-white p-3 rounded-lg shadow-lg animate-bounce-slow">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div className="absolute -left-6 top-1/3 bg-primary/90 text-white p-3 rounded-lg shadow-lg animate-pulse">
              <Shield className="h-6 w-6" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section with Icons and Better Layout */}
      <section className="w-full py-24 bg-gradient-to-b from-background to-muted/30">
        <div className="container">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Comprehensive Security Checks
            </h2>
            <p className="text-xl text-muted-foreground">
              Our platform performs thorough analysis of your Supabase configurations
              to prevent security vulnerabilities and ensure best practices.
            </p>
          </div>
          
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-blue-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative h-full rounded-2xl border bg-card p-8 shadow-sm transition-all hover:shadow-md">
                <div className="mb-5 inline-flex items-center justify-center rounded-full bg-primary/10 p-3 text-primary">
                  <LockKeyhole className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">MFA Verification</h3>
                <p className="text-muted-foreground mb-4">
                  Ensure multi-factor authentication is enabled for all users to enhance security and prevent unauthorized access.
                </p>
                <div className="pt-2 text-sm flex items-center text-primary font-medium">
                  <Link href="/register" className="flex items-center hover:underline">
                    <span>Learn more</span>
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
            
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-blue-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative h-full rounded-2xl border bg-card p-8 shadow-sm transition-all hover:shadow-md">
                <div className="mb-5 inline-flex items-center justify-center rounded-full bg-primary/10 p-3 text-primary">
                  <Database className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">RLS Monitoring</h3>
                <p className="text-muted-foreground mb-4">
                  Verify Row Level Security is properly configured across all your tables to maintain data access control.
                </p>
                <div className="pt-2 text-sm flex items-center text-primary font-medium">
                  <Link href="/register" className="flex items-center hover:underline">
                    <span>Learn more</span>
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
            
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-blue-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative h-full rounded-2xl border bg-card p-8 shadow-sm transition-all hover:shadow-md">
                <div className="mb-5 inline-flex items-center justify-center rounded-full bg-primary/10 p-3 text-primary">
                  <Server className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">PITR Checks</h3>
                <p className="text-muted-foreground mb-4">
                  Monitor Point in Time Recovery settings to prevent data loss and ensure business continuity during incidents.
                </p>
                <div className="pt-2 text-sm flex items-center text-primary font-medium">
                  <Link href="/register" className="flex items-center hover:underline">
                    <span>Learn more</span>
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Real-time Monitoring Section */}
      <section className="w-full py-24">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <div className="inline-flex items-center px-3 py-1 mb-6 text-sm font-medium rounded-full bg-blue-500/10 text-blue-500">
                <Activity className="w-4 h-4 mr-2" />
                Real-time Monitoring
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
                Instant alerts for configuration changes
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                Get notified immediately when security configurations change in your Supabase projects. 
                Monitor compliance status in real-time with our advanced monitoring dashboard.
              </p>
              
              <div className="space-y-4">
                {[
                  'Live configuration monitoring',
                  'Detailed compliance evidence logs',
                  'Real-time webhooks and notifications',
                  'Historical audit trail for all changes'
                ].map((feature, i) => (
                  <div key={i} className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              
              <Button className="mt-8 rounded-full">
                <Link href="/register" className="flex items-center">
                  Learn More About Monitoring
                </Link>
              </Button>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 to-primary/30 rounded-3xl blur-2xl opacity-20"></div>
              <div className="relative rounded-2xl border bg-card/80 backdrop-blur-sm p-2 shadow-xl">
                <div className="aspect-[4/3] rounded-xl overflow-hidden border bg-background">
                  <div className="w-full h-full flex flex-col">
                    <div className="border-b p-3 flex items-center justify-between">
                      <div className="bg-muted h-4 w-32 rounded-md"></div>
                      <div className="flex space-x-2">
                        <div className="h-4 w-4 rounded-full bg-blue-500"></div>
                        <div className="h-4 w-4 rounded-full bg-green-500"></div>
                      </div>
                    </div>
                    <div className="flex-1 grid grid-cols-5 p-4 gap-4">
                      <div className="col-span-2 space-y-3">
                        <div className="h-4 bg-muted rounded-md w-full"></div>
                        <div className="h-4 bg-muted rounded-md w-3/4"></div>
                        <div className="h-4 bg-muted rounded-md w-5/6"></div>
                        <div className="h-4 bg-primary/20 rounded-md w-full mt-6"></div>
                        <div className="h-20 bg-muted/50 rounded-md w-full mt-4"></div>
                      </div>
                      <div className="col-span-3 flex flex-col space-y-3">
                        <div className="h-8 bg-blue-500/20 rounded-md w-full"></div>
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <div className="h-full bg-green-500/20 rounded-md"></div>
                          <div className="h-full bg-red-500/20 rounded-md"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Animated dot to simulate real-time updates */}
                <div className="absolute top-3 right-3">
                  <span className="flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Testimonials Section */}
      <section className="w-full py-24 bg-gradient-to-b from-muted/30 to-background">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Trusted by Security Teams
            </h2>
            <p className="text-xl text-muted-foreground">
              Hear from our customers who have improved their Supabase security posture.
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                quote: "Supa-pliance helped us identify and fix critical security issues in our Supabase configuration before they became problems.",
                author: "Alex Morgan",
                role: "CTO, TechFlow",
                avatar: "A",
                image: "https://randomuser.me/api/portraits/men/32.jpg"
              },
              {
                quote: "The real-time monitoring features have been a game changer for our security compliance requirements.",
                author: "Sarah Chen",
                role: "Security Lead, DataStream",
                avatar: "S",
                image: "https://randomuser.me/api/portraits/women/44.jpg"
              },
              {
                quote: "We've reduced our security audit time by 70% since implementing Supa-pliance across our projects.",
                author: "Michael Okonjo",
                role: "DevOps Manager, CloudSecure",
                avatar: "M",
                image: "https://randomuser.me/api/portraits/men/68.jpg"
              }
            ].map((testimonial, i) => (
              <div key={i} className="relative rounded-2xl border bg-card p-8 shadow-sm">
                <div className="mb-4 text-lg italic text-muted-foreground">
                  "{testimonial.quote}"
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full overflow-hidden">
                    <img 
                      src={testimonial.image} 
                      alt={`Photo of ${testimonial.author}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-medium">{testimonial.author}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Call to Action Section */}
      <section className="w-full py-24">
        <div className="container">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-blue-600"></div>
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 mix-blend-soft-light"></div>
            <div className="relative py-20 px-8 md:px-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4 text-white">
                Start securing your Supabase projects today
              </h2>
              <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10">
                Join hundreds of companies using Supa-pliance to ensure their Supabase configurations are secure and compliant.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button size="lg" variant="secondary" className="rounded-full text-base px-8 shadow-lg">
                  <Link href="/register" className="flex items-center">
                    Get Started <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="rounded-full text-base px-8 bg-white/10 text-white hover:bg-white/20 border-white/20">
                  <Link href="/login">View Demo</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
