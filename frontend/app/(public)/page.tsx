import Link from "next/link";
import { getL } from "@/lib/i18n/server";

export default function HomePage() {
  const L = getL();
  const featureCards = [
    {
      title: L("Orders", "Commandes"),
      description: L(
        "Centralize and track all\nyour orders in real time.",
        "Centralisez et suivez toutes\nvos commandes en temps réel."
      ),
      href: "/orders",
      bgClass: "bg-[#E2EFE8] border-[#D4E5DC] text-[#0B2A22]",
    },
    {
      title: L("Menu", "Menu"),
      description: L(
        "Create and update your menu\nwith simplicity.",
        "Créez et mettez à jour votre menu\nen toute simplicité."
      ),
      href: "/menu",
      bgClass: "bg-[#F5F0E3] border-[#EAE2CE] text-[#0B2A22]",
    },
    {
      title: L("Reservations", "Réservations"),
      description: L(
        "Manage your reservations and optimize\nyour service.",
        "Gérez vos réservations et optimisez\nvotre service."
      ),
      href: "/reservations",
      bgClass: "bg-[#E5F0F5] border-[#D5E5EE] text-[#0B2A22]",
    },
  ];

  return (
    <div className="flex flex-1 min-h-0 flex-col justify-between overflow-hidden">
      <section className="relative flex flex-1 min-h-0 w-full items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-full lg:w-[64%]">
          <img
            src="/images/p10-hero-fade.png"
            alt="ZAYQORA restaurant dining table"
            className="h-full w-full object-cover object-left"
          />
        </div>

        <div className="relative z-10 mx-auto flex h-full w-full max-w-[1520px] items-center px-6 lg:px-12">
          <div className="max-w-xl">
            <h1 className="text-4xl font-bold leading-[1.06] tracking-tight sm:text-[46px] xl:text-[50px]">
              {L("Manage your", "Gérez votre")}
              <br />
              {L("restaurant with", "restaurant avec")}
              <br />
              {L("simplicity", "simplicité")}
            </h1>
            <p className="mt-3.5 text-lg leading-snug text-muted-foreground">
              {L(
                "ZAYQORA brings together orders, menu and",
                "ZAYQORA réunit commandes, menu et"
              )}
              <br />
              {L("reservations.", "réservations.")}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3.5">
              <Link
                href="/dashboard"
                className="rounded-full bg-gold px-7 py-2.5 text-sm font-medium text-[#0B2A22] transition hover:opacity-90"
              >
                {L("Discover the platform", "Découvrir la plateforme")}
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-[#DCECE3] px-7 py-2.5 text-sm font-medium text-[#0B2A22] transition hover:bg-[#CCE2D6]"
              >
                {L("Request a demo", "Demander une démo")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto flex h-[21vh] min-h-[132px] w-full max-w-[1520px] shrink-0 items-center px-6 lg:px-12">
        <div className="grid h-[82%] w-full gap-5 md:grid-cols-3">
          {featureCards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className={`group flex flex-col justify-center rounded-2xl border px-7 py-4 transition hover:shadow-md ${card.bgClass}`}
            >
              <h2 className="text-xl font-bold xl:text-2xl">{card.title}</h2>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-snug text-[#42524C] xl:text-[15px]">
                {card.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="relative flex h-[19.5vh] min-h-[120px] shrink-0 flex-col items-center justify-center overflow-hidden bg-sidebar text-center text-sidebar-foreground">
        <img
          src="/images/arch-left.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-full w-auto object-contain opacity-90"
        />
        <img
          src="/images/arch-right.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 h-full w-auto object-contain opacity-90"
        />

        <div className="relative z-10 mx-auto max-w-3xl px-6">
          <h2 className="text-2xl font-bold tracking-tight text-white xl:text-[32px]">
            {L("Ready to simplify your service?", "Prêt à simplifier votre service ?")}
          </h2>
          <div className="mt-3.5">
            <Link
              href="/login"
              className="inline-block rounded-full bg-gold px-9 py-2.5 text-sm font-medium text-[#0B2A22] transition hover:opacity-90 xl:text-base"
            >
              {L("Create my restaurant", "Créer mon restaurant")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
