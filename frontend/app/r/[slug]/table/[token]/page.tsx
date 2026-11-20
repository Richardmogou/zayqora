import Link from "next/link";
import { notFound } from "next/navigation";
import { Utensils } from "lucide-react";
import { serverFetch } from "@/lib/auth";

interface PublicTableInfo {
  restaurant_slug: string;
  restaurant_name: string;
  table_id: string;
  area_name: string;
  table_label: string;
  capacity: number;
}

export default async function PublicTableQrPage({
  params,
}: {
  params: { slug: string; token: string };
}) {
  const table = await serverFetch<PublicTableInfo>(`/public/tables/${encodeURIComponent(params.token)}`);
  if (!table || table.restaurant_slug !== params.slug) notFound();
  const base = `/r/${params.slug}`;
  const encodedTable = encodeURIComponent(table.table_label);

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#E5F1EB] text-[#0B2A22]">
          <Utensils className="h-7 w-7" />
        </span>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-[#C4933F]">
          {table.area_name} · Table ordering
        </p>
        <h1 className="mt-1 text-3xl font-bold text-[#0B2A22]">{table.table_label}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Welcome to <strong>{table.restaurant_name}</strong>. Browse the menu and send your dine-in order directly to the kitchen for{" "}
          <strong>{table.table_label}</strong>.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={`${base}/menu`}
            className="rounded-xl bg-[#0B2A22] px-6 py-3 text-sm font-semibold text-white hover:bg-[#163F34]"
          >
            Browse menu
          </Link>
          <Link
            href={`${base}/checkout?mode=dine-in&table=${encodedTable}`}
            className="rounded-xl bg-[#D5E9DE] px-6 py-3 text-sm font-semibold text-[#0B2A22] hover:bg-[#C3DFD0]"
          >
            Checkout for {table.table_label}
          </Link>
        </div>
      </div>
    </div>
  );
}
