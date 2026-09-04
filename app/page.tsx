import { Phase0ToastCheck } from "@/components/phase-0-toast-check";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Vendor Buddy
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Phase 0 scaffold
        </h1>
        <p className="max-w-md text-muted-foreground">
          The local app shell is ready for environment verification.
        </p>
      </div>
      <Phase0ToastCheck />
    </main>
  );
}
