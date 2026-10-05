import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

type AdminCheck =
  | { authorized: true; userId: string }
  | { authorized: false; userId: null };

async function getAdminUserId() {
  const configuredAdminId = process.env.ADMIN_CLERK_USER_ID?.trim();

  if (configuredAdminId) {
    return configuredAdminId;
  }

  const client = await clerkClient();
  const users = await client.users.getUserList({
    limit: 1,
    orderBy: "created_at",
  });

  return users.data[0]?.id;
}

export async function checkAdmin(): Promise<AdminCheck> {
  const { userId } = await auth();

  if (!userId) {
    return { authorized: false, userId: null };
  }

  const configuredAdmin = process.env.ADMIN_CLERK_USER_ID?.trim();
  if (configuredAdmin === userId) {
    return { authorized: true, userId };
  }

  if (configuredAdmin && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredAdmin)) {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const authorized = user.emailAddresses.some(
      (email) =>
        email.emailAddress.toLowerCase() === configuredAdmin.toLowerCase() &&
        email.verification?.status === "verified",
    );
    return authorized
      ? { authorized: true, userId }
      : { authorized: false, userId: null };
  }

  const adminUserId = configuredAdmin ?? (await getAdminUserId());

  return adminUserId === userId
    ? { authorized: true, userId }
    : { authorized: false, userId: null };
}

export async function requireAdmin() {
  const result = await checkAdmin();

  if (!result.authorized) {
    redirect("/");
  }

  return result.userId;
}
