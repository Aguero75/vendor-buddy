"use client";

import { LogOut } from "lucide-react";
import { useClerk } from "@clerk/nextjs";

export function SignOutButton() {
  const { signOut } = useClerk();

  return (
    <button
      type="button"
      onClick={() => signOut({ redirectUrl: "/sign-in" })}
      className="nav-link shrink-0 text-red-200 hover:bg-red-950/40 hover:text-red-100"
    >
      <LogOut className="size-4" />
      <span>Log out</span>
    </button>
  );
}
