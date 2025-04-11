export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
      <div className="w-full max-w-[400px] px-4">
        {children}
      </div>
    </div>
  );
} 