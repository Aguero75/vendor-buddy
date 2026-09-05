import { DashboardHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { requireAdmin } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
