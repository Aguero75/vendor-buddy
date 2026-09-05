export default function ReceiptsLoading() {
  return (
    <main className="shell space-y-8 py-12">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-3">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-10 w-44" />
          <div className="skeleton h-5 w-72 max-w-full" />
        </div>
        <div className="skeleton hidden h-9 w-32 rounded-lg sm:block" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="skeleton h-80 rounded-2xl" />
        <div className="skeleton h-80 rounded-2xl" />
      </div>
      <div className="skeleton h-40 rounded-2xl" />
    </main>
  );
}
