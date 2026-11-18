"use client";
import { useState } from "react";
import Link from "next/link";
import { Clock, Search, Star } from "lucide-react";

export interface PublicModifier {
  id: string;
  name: string;
  price_delta_minor: number;
  is_default: boolean;
}

export interface PublicModifierGroup {
  id: string;
  name: string;
  required: boolean;
  multi_select: boolean;
  modifiers: PublicModifier[];
}

export interface PublicItem {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_minor: number;
  discounted_price_minor: number | null;
  prep_time_minutes: number | null;
  allergens: string | null;
  dietary_tags: string | null;
  is_featured: boolean;
  is_available: boolean;
  modifier_groups: PublicModifierGroup[];
}

export interface PublicCategory {
  id: string;
  name: string;
  position: number;
  items: PublicItem[];
}

export function MenuBrowser({
  base,
  sym,
  categories,
}: {
  base: string;
  sym: string;
  categories: PublicCategory[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"default" | "price_asc" | "price_desc">("default");

  const query = search.trim().toLowerCase();
  const visibleCategories = categories
    .filter((cat) => selectedCategory === "ALL" || cat.id === selectedCategory)
    .map((cat) => {
      const filtered = cat.items.filter(
        (dish) =>
          !query ||
          dish.name.toLowerCase().includes(query) ||
          (dish.description ?? "").toLowerCase().includes(query) ||
          (dish.dietary_tags ?? "").toLowerCase().includes(query)
      );
      const sorted = [...filtered].sort((a, b) => {
        const effA = a.discounted_price_minor ?? a.price_minor;
        const effB = b.discounted_price_minor ?? b.price_minor;
        if (sortBy === "price_asc") return effA - effB;
        if (sortBy === "price_desc") return effB - effA;
        if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
        return 0;
      });
      return { ...cat, items: sorted };
    })
    .filter((cat) => cat.items.length > 0);

  return (
    <div className="space-y-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
              selectedCategory === "ALL"
                ? "bg-[#0B2A22] text-white"
                : "border border-border bg-white text-[#0B2A22] hover:bg-[#E5F1EB]"
            }`}
          >
            All categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                selectedCategory === cat.id
                  ? "bg-[#0B2A22] text-white"
                  : "border border-border bg-white text-[#0B2A22] hover:bg-[#E5F1EB]"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search dishes or dietary tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-white pl-10 pr-3.5 text-xs text-[#0B2A22] focus:outline-none sm:w-64"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "default" | "price_asc" | "price_desc")}
            className="h-10 rounded-xl border border-border bg-white px-3 text-xs font-medium text-[#0B2A22] focus:outline-none"
          >
            <option value="default">Sort: Featured first</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {visibleCategories.length === 0 && (
        <p className="py-16 text-center text-sm text-slate-500">No items available at the moment.</p>
      )}

      {visibleCategories.map((cat) => (
        <div key={cat.id}>
          <h2 className="mb-4 text-xl font-bold text-[#0B2A22] sm:text-2xl">{cat.name}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cat.items.map((dish) => {
              const tags = dish.dietary_tags
                ? dish.dietary_tags.split(",").map((t) => t.trim()).filter(Boolean)
                : [];
              return (
                <div key={dish.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
                  <Link href={`${base}/menu/${dish.id}`} className="relative block">
                    {dish.image_url ? (
                      <img src={dish.image_url} alt={dish.name} className="h-52 w-full object-cover" />
                    ) : (
                      <div className="h-52 w-full bg-[#E5F1EB]" />
                    )}
                    {dish.is_featured && (
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#C4933F] px-3 py-1 text-xs font-bold text-[#0B2A22] shadow-sm">
                        <Star className="h-3 w-3 fill-[#0B2A22]" /> Chef’s Pick
                      </span>
                    )}
                    <span
                      className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
                        dish.is_available ? "bg-[#DCF0E5] text-[#1D6846]" : "bg-[#FADCD9] text-[#B4322A]"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${dish.is_available ? "bg-[#1D6846]" : "bg-[#B4322A]"}`} />
                      {dish.is_available ? "Available" : "Unavailable"}
                    </span>
                  </Link>
                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`${base}/menu/${dish.id}`} className="text-xl font-bold text-[#0B2A22] hover:underline">
                          {dish.name}
                        </Link>
                        {dish.prep_time_minutes && (
                          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-500">
                            <Clock className="h-3 w-3" /> {dish.prep_time_minutes} min
                          </span>
                        )}
                      </div>
                      {dish.description && <p className="mt-2 text-xs leading-relaxed text-slate-600">{dish.description}</p>}
                      {tags.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-md bg-[#E5F1EB] px-2 py-0.5 text-[10px] font-semibold text-[#0B2A22]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-5 flex items-center justify-between pt-2">
                      <div>
                        {dish.discounted_price_minor != null ? (
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-extrabold text-[#1D6846]">
                              {sym}
                              {(dish.discounted_price_minor / 100).toFixed(2)}
                            </span>
                            <span className="text-sm font-medium text-slate-400 line-through">
                              {sym}
                              {(dish.price_minor / 100).toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-2xl font-extrabold text-[#C4933F]">
                            {sym}
                            {(dish.price_minor / 100).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <Link
                        href={`${base}/menu/${dish.id}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#0B2A22] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#163F34]"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="border-t border-border/60 pt-4 text-xs text-slate-500">
        Allergen &amp; dietary notice: Ingredient, allergen and dietary labels are provided and verified by the restaurant. If you have a severe allergy, please contact the restaurant directly before ordering.
      </p>
    </div>
  );
}
