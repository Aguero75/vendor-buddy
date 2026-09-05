import { SignUp } from "@clerk/nextjs";
import { clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function SignUpPage() {
  if (process.env.ADMIN_CLERK_USER_ID) {
    redirect("/sign-in");
  }

  const client = await clerkClient();
  const userCount = await client.users.getCount();

  if (userCount > 0) {
    redirect("/sign-in");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
    </main>
  );
}
