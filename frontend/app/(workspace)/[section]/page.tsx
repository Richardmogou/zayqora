import { Construction } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getL, getT } from "@/lib/i18n/server";

// Écrans provisoires du menu : chacun sera remplacé par sa vraie page le jour prévu.
const SECTIONS: Record<string, number> = {};

export default function SectionPlaceholder({ params }: { params: { section: string } }) {
  const day = SECTIONS[params.section];
  if (!day) notFound();
  const L = getL();
  const t = getT();
  return (
    <>
      <PageHeader title={t(`nav.${params.section}`)} />
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <Construction className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="font-medium">{L("Under construction", "En construction")}</p>
        <p className="text-sm text-muted-foreground">{L(`Planned for day ${day}.`, `Prévu au jour ${day}.`)}</p>
      </div>
    </>
  );
}
