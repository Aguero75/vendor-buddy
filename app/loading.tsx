"use client";
import { TailSpin } from "react-loader-spinner";

export default function Loading() {
  return (
    <main className="shell flex min-h-[60vh] items-center justify-center py-16">
      <div
        className="space-y-3 text-center flex flex-col items-center"
        role="status"
        aria-label="Loading"
      >
        <TailSpin height="40" width="40" color="#C9892B" />
        <p className="text-sm text-muted-foreground">
          store is loading, please wait...
        </p>
      </div>
    </main>
  );
}
