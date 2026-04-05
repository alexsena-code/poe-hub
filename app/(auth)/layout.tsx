import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      {/* On mobile, add top padding to clear the fixed hamburger bar (h-14) */}
      <main id="app-main" className="flex-1 overflow-auto p-6 px-8 pt-20 md:pt-6 lg:px-12">{children}</main>
      <Toaster />
    </div>
  );
}
