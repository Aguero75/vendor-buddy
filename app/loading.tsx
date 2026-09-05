export default function Loading() {
  return (
    <main className="shell flex min-h-[60vh] items-center justify-center py-16">
      <div className="space-y-3 text-center" role="status" aria-label="Loading">
        <span className="loading-orbit" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Preparing your storefront
        </p>
      </div>
    </main>
  );
}
