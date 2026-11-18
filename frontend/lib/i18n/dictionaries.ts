export const LOCALES = ["en", "fr"] as const; // l'anglais est la langue par défaut
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const COOKIE = "locale";

const en = {
  brand: { tagline: "The Complete Digital Restaurant Platform" },
  nav: { dashboard: "Dashboard", menu: "Menu", orders: "Orders", kitchen: "Kitchen", reservations: "Reservations", notifications: "Notifications", customers: "Customers", reports: "Reports", settings: "Settings" },
  common: { theme: "Theme", light: "Light", dark: "Dark", system: "System", language: "Language", signIn: "Sign in", signOut: "Sign out", mainNav: "Main navigation", account: "Account" },
  auth: { welcome: "Welcome back", subtitle: "Sign in to your restaurant workspace", email: "Email", password: "Password", signIn: "Sign in", signingIn: "Signing in…", invalid: "Invalid email or password.", tooMany: "Too many attempts. Please wait a few minutes and try again.", unavailable: "Sign-in is unavailable right now. Please try again.", expired: "Your session has expired. Please sign in again.", showPassword: "Show password", hidePassword: "Hide password", backHome: "Back to home", register: "Create account", registering: "Creating account…", fullName: "Full name", restaurantName: "Restaurant name", alreadyHaveAccount: "Already have an account?", emailTaken: "This email is already registered.", registerUnavailable: "Registration is unavailable right now." },
  orders: { title: "Orders", subtitle: "Manage and track all your restaurant orders", search: "Search by order number or customer", period: "Period", status: "Status", serviceMode: "Service mode", payment: "Payment", all: "All", today: "Today", thisWeek: "This week", dineIn: "Dine-in", takeaway: "Takeaway", delivery: "Delivery", creditCard: "Credit card", cash: "Cash", online: "Online", open: "Open", back: "Back to orders", orderNumber: "Order number", orderDate: "Order date", orderedItems: "Ordered items", item: "Item", quantity: "Quantity", details: "Details", allergens: "Allergens", history: "Order history", customerInfo: "Customer information", customer: "Customer", phone: "Phone", table: "Table", amountSummary: "Amount summary", subtotal: "Subtotal", serviceFee: "Service fee", total: "Total", actions: "Actions", markReady: "Mark as ready", editOrder: "Edit order", cancelOrder: "Cancel order" },
  roles: { owner: "Owner", manager: "Manager", cashier: "Cashier", kitchen: "Kitchen", waiter: "Waiter", rider: "Rider", accountant: "Accountant", platform_admin: "Platform admin" },
};
export type Dict = typeof en;

const fr: Dict = {
  brand: { tagline: "La plateforme digitale complète pour restaurants" },
  nav: { dashboard: "Tableau de bord", menu: "Menu", orders: "Commandes", kitchen: "Cuisine", reservations: "Réservations", notifications: "Notifications", customers: "Clients", reports: "Rapports", settings: "Paramètres" },
  common: { theme: "Thème", light: "Clair", dark: "Sombre", system: "Système", language: "Langue", signIn: "Se connecter", signOut: "Se déconnecter", mainNav: "Navigation principale", account: "Compte" },
  auth: { welcome: "Bon retour", subtitle: "Connectez-vous à l'espace de votre restaurant", email: "E-mail", password: "Mot de passe", signIn: "Se connecter", signingIn: "Connexion…", invalid: "E-mail ou mot de passe incorrect.", tooMany: "Trop de tentatives. Patientez quelques minutes puis réessayez.", unavailable: "La connexion est indisponible pour le moment. Réessayez.", expired: "Votre session a expiré. Reconnectez-vous.", showPassword: "Afficher le mot de passe", hidePassword: "Masquer le mot de passe", backHome: "Retour à l'accueil", register: "Créer un compte", registering: "Création du compte…", fullName: "Nom complet", restaurantName: "Nom du restaurant", alreadyHaveAccount: "Déjà un compte ?", emailTaken: "Cet e-mail est déjà enregistré.", registerUnavailable: "L'inscription est indisponible pour le moment." },
  orders: { title: "Commandes", subtitle: "Gérez et suivez toutes les commandes de votre restaurant", search: "Rechercher par numéro ou client", period: "Période", status: "Statut", serviceMode: "Mode de service", payment: "Paiement", all: "Tous", today: "Aujourd'hui", thisWeek: "Cette semaine", dineIn: "Sur place", takeaway: "À emporter", delivery: "Livraison", creditCard: "Carte bancaire", cash: "Espèces", online: "En ligne", open: "Ouvrir", back: "Retour aux commandes", orderNumber: "N° commande", orderDate: "Date de commande", orderedItems: "Articles commandés", item: "Article", quantity: "Qté", details: "Détails", allergens: "Allergènes", history: "Historique", customerInfo: "Informations client", customer: "Client", phone: "Téléphone", table: "Table", amountSummary: "Récapitulatif", subtotal: "Sous-total", serviceFee: "Frais de service", total: "Total", actions: "Actions", markReady: "Marquer prêt", editOrder: "Modifier", cancelOrder: "Annuler" },
  roles: { owner: "Propriétaire", manager: "Gérant", cashier: "Caissier", kitchen: "Cuisine", waiter: "Serveur", rider: "Livreur", accountant: "Comptable", platform_admin: "Admin plateforme" },
};

export const dictionaries: Record<Locale, Dict> = { en, fr };
export type Vars = Record<string, string | number>;

export function translate(dict: Dict, key: string, vars?: Vars): string {
  const raw = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dict);
  const s = typeof raw === "string" ? raw : key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : s;
}
