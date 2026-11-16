import { LocaleSwitcher } from "@/components/locale-switcher";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getT } from "@/lib/i18n/server";

export function Topbar({ name, role }: { name: string; role: string }) {
  const t = getT();
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <header className="flex h-16 items-center justify-end gap-3 border-b border-border bg-card px-4 md:px-6">
      <LocaleSwitcher />
      <ThemeToggle />
      <div className="flex items-center gap-2 pl-2">
        <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials}</span>
        <div className="hidden leading-tight sm:block">
          <p className="text-sm font-medium">{name}</p>
          {role && <p className="text-xs text-muted-foreground">{t(`roles.${role}`)}</p>}
        </div>
      </div>
      <LogoutButton />
    </header>
  );
}
