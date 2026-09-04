export default function DashboardPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Vendor Buddy
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Admin dashboard
        </h1>
        <p className="text-muted-foreground">You are signed in.</p>
      </div>
    </main>
  );
}
