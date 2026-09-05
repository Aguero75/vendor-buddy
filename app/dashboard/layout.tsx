import { auth } from "@clerk/nextjs/server";

import { DashboardHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await auth.protect();

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
