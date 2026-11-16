"use client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";

export function LogoutButton() {
  const router = useRouter();
  const t = useT();
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }
  return (
    <button type="button" onClick={logout} aria-label={t("common.signOut")} title={t("common.signOut")}
      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <LogOut className="h-5 w-5" />
    </button>
  );
}
