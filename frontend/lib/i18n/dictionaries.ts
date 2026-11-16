export const LOCALES = ["en", "fr"] as const; // l'anglais est la langue par défaut
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const COOKIE = "locale";

const en = {
  brand: { tagline: "The Complete Digital Restaurant Platform" },
  nav: { dashboard: "Dashboard", menu: "Menu", orders: "Orders", reservations: "Reservations", customers: "Customers", reports: "Reports", settings: "Settings" },
  common: { theme: "Theme", light: "Light", dark: "Dark", system: "System", language: "Language", signIn: "Sign in", signOut: "Sign out", mainNav: "Main navigation", account: "Account" },
  auth: { welcome: "Welcome back", subtitle: "Sign in to your restaurant workspace", email: "Email", password: "Password", signIn: "Sign in", signingIn: "Signing in…", invalid: "Invalid email or password.", tooMany: "Too many attempts. Please wait a few minutes and try again.", unavailable: "Sign-in is unavailable right now. Please try again.", expired: "Your session has expired. Please sign in again.", showPassword: "Show password", hidePassword: "Hide password", backHome: "Back to home" },
  roles: { owner: "Owner", manager: "Manager", cashier: "Cashier", kitchen: "Kitchen", waiter: "Waiter", rider: "Rider", accountant: "Accountant", platform_admin: "Platform admin" },
};
export type Dict = typeof en;

const fr: Dict = {
  brand: { tagline: "La plateforme digitale complète pour restaurants" },
  nav: { dashboard: "Tableau de bord", menu: "Menu", orders: "Commandes", reservations: "Réservations", customers: "Clients", reports: "Rapports", settings: "Paramètres" },
  common: { theme: "Thème", light: "Clair", dark: "Sombre", system: "Système", language: "Langue", signIn: "Se connecter", signOut: "Se déconnecter", mainNav: "Navigation principale", account: "Compte" },
  auth: { welcome: "Bon retour", subtitle: "Connectez-vous à l'espace de votre restaurant", email: "E-mail", password: "Mot de passe", signIn: "Se connecter", signingIn: "Connexion…", invalid: "E-mail ou mot de passe incorrect.", tooMany: "Trop de tentatives. Patientez quelques minutes puis réessayez.", unavailable: "La connexion est indisponible pour le moment. Réessayez.", expired: "Votre session a expiré. Reconnectez-vous.", showPassword: "Afficher le mot de passe", hidePassword: "Masquer le mot de passe", backHome: "Retour à l'accueil" },
  roles: { owner: "Propriétaire", manager: "Gérant", cashier: "Caissier", kitchen: "Cuisine", waiter: "Serveur", rider: "Livreur", accountant: "Comptable", platform_admin: "Admin plateforme" },
};

export const dictionaries: Record<Locale, Dict> = { en, fr };
export type Vars = Record<string, string | number>;

export function translate(dict: Dict, key: string, vars?: Vars): string {
  const raw = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dict);
  const s = typeof raw === "string" ? raw : key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : s;
}
