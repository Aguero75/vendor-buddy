export default function DashboardLoading() {
  return (
    <main className="shell space-y-8 py-12">
      <div className="space-y-3">
        <div className="skeleton h-4 w-28" />
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-5 w-80 max-w-full" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="skeleton h-80 rounded-2xl" />
        <div className="skeleton h-80 rounded-2xl" />
      </div>
    </main>
  );
}
