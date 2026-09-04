"use client";

import { toast } from "react-toastify";

export function Phase0ToastCheck() {
  return (
    <button
      type="button"
      onClick={() => toast.success("It works")}
      className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85"
    >
      Test toast
    </button>
  );
}
