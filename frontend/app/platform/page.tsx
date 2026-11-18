import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { getCurrentUser, serverFetch } from "@/lib/auth";
import { PlatformConsole, type PlatformOverview, type PlatformTenant } from "./platform-console";

export default async function PlatformPage() {
  const me = await getCurrentUser().catch(() => null);
  if (!me) redirect("/login?next=/platform");
  if (!me.user.is_platform_admin) redirect("/dashboard");

  const [overview, tenants] = await Promise.all([
    serverFetch<PlatformOverview>("/platform/overview"),
    serverFetch<PlatformTenant[]>("/platform/tenants"),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border bg-sidebar px-6 py-3 text-sidebar-foreground">
        <div className="flex items-center gap-4">
          <Link href="/platform" className="flex items-center gap-2.5">
            <img src="/images/logo-emblem.png" alt="" className="h-8 w-8 object-contain" />
            <div>
              <span className="font-serif text-lg tracking-[0.08em] text-gold">ZAYQORA</span>
              <span className="ml-2 rounded bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                VIRELEO Super Admin
              </span>
            </div>
          </Link>
          {me.memberships.length > 0 && (
            <Link
              href="/dashboard"
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              Restaurant Workspace
            </Link>
          )}
        </div>
      </div>
      <Topbar name={me.user.full_name} role="platform_admin" />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        {overview && tenants ? (
          <PlatformConsole initialOverview={overview} initialTenants={tenants} />
        ) : (
          <p className="text-sm text-muted-foreground">Could not load platform overview.</p>
        )}
      </main>
    </div>
  );
}
