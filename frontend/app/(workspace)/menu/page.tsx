"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { currencySymbol } from "@/lib/currency-context";
import { useT } from "@/lib/i18n/provider";

interface Category {
  id: string;
  name: string;
  position: number;
  is_active: boolean;
}

interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_minor: number;
  discounted_price_minor: number | null;
  tax_rate: string;
  prep_time_minutes: number | null;
  kitchen_station: string | null;
  allergens: string | null;
  dietary_tags: string | null;
  is_featured: boolean;
  is_available: boolean;
  is_published: boolean;
}

interface MeResponse {
  memberships: { restaurant_id: string; restaurant_slug: string; role: string }[];
}

interface RestaurantResponse {
  currency: string;
  slug: string;
}

export default function MenuPage() {
  const t = useT();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);
  const [role, setRole] = useState<string>("owner");
  const [currency, setCurrency] = useState("EUR");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [availFilter, setAvailFilter] = useState("ALL");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const canEdit = role === "owner" || role === "manager";
  const sym = currencySymbol(currency);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const me = await api<MeResponse>("/auth/me");
        const membership = me.memberships[0];
        if (!membership || !active) return;
        const headers = { "X-Restaurant-Id": membership.restaurant_id };
        setRestaurantId(membership.restaurant_id);
        setRestaurantSlug(membership.restaurant_slug);
        setRole(membership.role);
        const [rest, cats, menuItems] = await Promise.all([
          api<RestaurantResponse>("/restaurants/me", { headers }),
          api<Category[]>("/menu/categories", { headers }),
          api<MenuItem[]>("/menu/items", { headers }),
        ]);
        if (!active) return;
        setCurrency(rest.currency);
        setRestaurantSlug(rest.slug);
        setCategories(cats);
        setItems(menuItems);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load menu.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function handleCreateCategory(e: FormEvent) {
    e.preventDefault();
    if (!restaurantId || !newCategoryName.trim()) return;
    setError(null);
    try {
      const created = await api<Category>("/menu/categories", {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({ name: newCategoryName.trim(), position: categories.length }),
      });
      setCategories((prev) => [...prev, created]);
      setNewCategoryName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create category.");
    }
  }

  async function handleUpdateCategory(catId: string, patch: Partial<Category>) {
    if (!restaurantId || !canEdit) return;
    setError(null);
    try {
      const updated = await api<Category>(`/menu/categories/${catId}`, {
        method: "PATCH",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify(patch),
      });
      setCategories((prev) =>
        prev.map((c) => (c.id === catId ? updated : c)).sort((a, b) => a.position - b.position)
      );
      setEditingCategoryId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update category.");
    }
  }

  async function handleMoveCategory(index: number, direction: -1 | 1) {
    if (!restaurantId || !canEdit) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;
    const current = categories[index];
    const neighbor = categories[targetIndex];
    try {
      const [u1, u2] = await Promise.all([
        api<Category>(`/menu/categories/${current.id}`, {
          method: "PATCH",
          headers: { "X-Restaurant-Id": restaurantId },
          body: JSON.stringify({ position: targetIndex }),
        }),
        api<Category>(`/menu/categories/${neighbor.id}`, {
          method: "PATCH",
          headers: { "X-Restaurant-Id": restaurantId },
          body: JSON.stringify({ position: index }),
        }),
      ]);
      setCategories((prev) =>
        prev
          .map((c) => (c.id === u1.id ? u1 : c.id === u2.id ? u2 : c))
          .sort((a, b) => a.position - b.position)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reorder category.");
    }
  }

  async function handleDeleteCategory(catId: string) {
    if (!restaurantId || !canEdit) return;
    setError(null);
    try {
      await api(`/menu/categories/${catId}`, {
        method: "DELETE",
        headers: { "X-Restaurant-Id": restaurantId },
      });
      setCategories((prev) => prev.filter((c) => c.id !== catId));
      setItems((prev) => prev.filter((i) => i.category_id !== catId));
      if (selectedCategory === catId) setSelectedCategory("ALL");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete category.");
    }
  }

  async function toggleAvailability(item: MenuItem) {
    if (!restaurantId) return;
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await api<MenuItem>(`/menu/items/${item.id}/availability`, {
        method: "PATCH",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({ is_available: !item.is_available }),
      });
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? updated : entry)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update availability.");
    } finally {
      setBusyId(null);
    }
  }

  async function togglePublished(item: MenuItem) {
    if (!restaurantId || !canEdit) return;
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await api<MenuItem>(`/menu/items/${item.id}`, {
        method: "PATCH",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({ is_published: !item.is_published }),
      });
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? updated : entry)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update publish status.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteItem(itemId: string) {
    if (!restaurantId || !canEdit) return;
    setBusyId(itemId);
    setError(null);
    try {
      await api(`/menu/items/${itemId}`, {
        method: "DELETE",
        headers: { "X-Restaurant-Id": restaurantId },
      });
      setItems((prev) => prev.filter((entry) => entry.id !== itemId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete item.");
    } finally {
      setBusyId(null);
    }
  }

  const categoryById = Object.fromEntries(categories.map((cat) => [cat.id, cat.name]));

  const filtered = items.filter((item) => {
    const query = search.trim().toLowerCase();
    return (
      (selectedCategory === "ALL" || item.category_id === selectedCategory) &&
      (!query || item.name.toLowerCase().includes(query)) &&
      (availFilter === "ALL" || (availFilter === "AVAILABLE" ? item.is_available : !item.is_available))
    );
  });

  const selectClass = "h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.menu")}
        description="Manage your restaurant categories, dishes and live availability"
        action={
          <div className="flex flex-wrap items-center gap-3">
            {restaurantSlug && (
              <Link
                href={`/r/${restaurantSlug}/menu`}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-4 text-xs font-semibold hover:bg-muted/40"
              >
                Preview public menu <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
            {canEdit && (
              <Link
                href="/menu/new"
                className="inline-flex h-10 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Add an item
              </Link>
            )}
          </div>
        }
      />

      {error && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setSelectedCategory("ALL")}
          className={`rounded-2xl border p-4 text-left transition ${
            selectedCategory === "ALL" ? "border-primary/40 bg-primary/10" : "border-border bg-card hover:bg-muted/30"
          }`}
        >
          <p className="text-sm font-bold">All categories</p>
          <p className="mt-1 text-xs text-muted-foreground">{items.length} items</p>
        </button>
        {categories.map((cat, idx) => {
          const count = items.filter((item) => item.category_id === cat.id).length;
          const active = selectedCategory === cat.id;
          return (
            <div
              key={cat.id}
              className={`rounded-2xl border p-4 transition ${
                active ? "border-primary/40 bg-primary/10" : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                {editingCategoryId === cat.id ? (
                  <div className="flex flex-1 items-center gap-1.5">
                    <input
                      type="text"
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      className="h-7 w-full rounded border border-border bg-card px-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => void handleUpdateCategory(cat.id, { name: editingCategoryName.trim() })}
                      className="rounded bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setSelectedCategory(cat.id)} className="text-left">
                    <p className="text-sm font-bold">{cat.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {count} items · {cat.is_active ? "Published" : "Archived"}
                    </p>
                  </button>
                )}
                {canEdit && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <button
                      type="button"
                      title="Move up"
                      disabled={idx === 0}
                      onClick={() => void handleMoveCategory(idx, -1)}
                      className="rounded p-1 hover:bg-muted disabled:opacity-30"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      disabled={idx === categories.length - 1}
                      onClick={() => void handleMoveCategory(idx, 1)}
                      className="rounded p-1 hover:bg-muted disabled:opacity-30"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Rename category"
                      onClick={() => {
                        setEditingCategoryId(cat.id);
                        setEditingCategoryName(cat.name);
                      }}
                      className="rounded p-1 hover:bg-muted"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title={cat.is_active ? "Archive category" : "Publish category"}
                      onClick={() => void handleUpdateCategory(cat.id, { is_active: !cat.is_active })}
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold hover:bg-muted"
                    >
                      {cat.is_active ? "Archive" : "Publish"}
                    </button>
                    <button
                      type="button"
                      title="Delete category"
                      onClick={() => void handleDeleteCategory(cat.id)}
                      className="rounded p-1 text-danger hover:bg-danger/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canEdit && (
        <form onSubmit={handleCreateCategory} className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="New category name (e.g. Starters)"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="h-10 w-64 rounded-xl border border-border bg-card px-3.5 text-sm focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newCategoryName.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-4 text-xs font-semibold hover:bg-muted/40 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add category
          </button>
        </form>
      )}

      <Card className="p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Menu items</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search an item..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-56 rounded-xl border border-border bg-card pl-10 pr-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className={selectClass}>
              <option value="ALL">All categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <select value={availFilter} onChange={(e) => setAvailFilter(e.target.value)} className={selectClass}>
              <option value="ALL">All</option>
              <option value="AVAILABLE">Available</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                <th className="px-4 py-3.5">Dish</th>
                <th className="px-4 py-3.5">Category &amp; Station</th>
                <th className="px-4 py-3.5">Price</th>
                <th className="px-4 py-3.5">Availability</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Loading menu items...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No menu items match your filter.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="h-11 w-14 shrink-0 rounded-lg border border-border object-cover"
                          />
                        ) : (
                          <div className="h-11 w-14 shrink-0 rounded-lg border border-dashed border-border bg-muted/30" />
                        )}
                        <div>
                          <div className="flex items-center gap-1.5 font-semibold text-primary">
                            <span>{item.name}</span>
                            {item.is_featured && (
                              <span title="Featured item" className="inline-flex items-center text-amber-500">
                                <Star className="h-3.5 w-3.5 fill-amber-400" />
                              </span>
                            )}
                          </div>
                          {item.dietary_tags && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{item.dietary_tags}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-foreground">{categoryById[item.category_id] ?? "—"}</p>
                      {item.kitchen_station && (
                        <p className="text-xs text-muted-foreground">{item.kitchen_station}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-semibold">
                      {item.discounted_price_minor != null ? (
                        <div>
                          <span className="text-success">
                            {sym}
                            {(item.discounted_price_minor / 100).toFixed(2)}
                          </span>
                          <span className="ml-1.5 text-xs text-muted-foreground line-through">
                            {sym}
                            {(item.price_minor / 100).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span>
                          {sym}
                          {(item.price_minor / 100).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge tone={item.is_available ? "success" : "warning"}>
                        {item.is_available ? "Available" : "Unavailable"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge tone={item.is_published ? "success" : "neutral"}>
                        {item.is_published ? "Published" : "Draft"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-4 text-xs font-semibold text-muted-foreground">
                        {canEdit && (
                          <Link href={`/menu/new?id=${item.id}`} className="hover:text-primary">
                            Edit
                          </Link>
                        )}
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void toggleAvailability(item)}
                          className="hover:text-primary disabled:opacity-50"
                        >
                          {item.is_available ? "Mark unavailable" : "Mark available"}
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => void togglePublished(item)}
                            className="hover:text-primary disabled:opacity-50"
                          >
                            {item.is_published ? "Unpublish" : "Publish"}
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => void deleteItem(item.id)}
                            className="inline-flex items-center gap-1 text-danger hover:underline disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
