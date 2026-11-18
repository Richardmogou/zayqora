import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getCurrentUser } from "@/lib/auth";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) redirect("/login");
  const membership = me.memberships[0] ?? null; // jour 2 : sélecteur de restaurant si plusieurs
  const role = membership?.role ?? (me.user.is_platform_admin ? "platform_admin" : "");

  return (
    <div className="flex min-h-screen">
      <Sidebar restaurantName={membership?.restaurant_name ?? "ZAYQORA"} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={me.user.full_name} role={role} isPlatformAdmin={me.user.is_platform_admin} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
