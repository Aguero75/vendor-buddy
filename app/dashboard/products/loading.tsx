export default function ProductsLoading() {
  return (
    <main className="shell space-y-8 py-12">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-3">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-10 w-44" />
          <div className="skeleton h-5 w-72 max-w-[70vw]" />
        </div>
        <div className="skeleton hidden h-9 w-28 rounded-lg sm:block" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="flex gap-4 border-b border-border p-6 last:border-0"
          >
            <div className="flex-1 space-y-3">
              <div className="skeleton h-5 w-48" />
              <div className="skeleton h-4 w-64 max-w-full" />
            </div>
            <div className="skeleton h-8 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    </main>
  );
}
