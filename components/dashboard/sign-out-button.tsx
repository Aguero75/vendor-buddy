"use client";

import { LogOut } from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { useState } from "react";

export function SignOutButton() {
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    await signOut();
    window.location.replace("/sign-in");
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="nav-link shrink-0 text-red-200 hover:bg-red-950/40 hover:text-red-100"
    >
      <LogOut className="size-4" />
      <span>{isSigningOut ? "Logging out..." : "Log out"}</span>
    </button>
  );
}
