"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Plus } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";

export interface IngredientItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity_minor: number;
  threshold_minor: number;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
}

export interface StockMovementItem {
  id: string;
  ingredient_id: string;
  delta_minor: number;
  reason: string;
  created_at: string;
}

const STATUS_TONE: Record<string, Tone> = {
  in_stock: "success",
  low_stock: "warning",
  out_of_stock: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
};

export function InventoryManager({
  restaurantId,
  initialItems,
  initialMovements,
  canEdit,
}: {
  restaurantId: string;
  initialItems: IngredientItem[];
  initialMovements: StockMovementItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<IngredientItem[]>(initialItems);
  const [movements, setMovements] = useState<StockMovementItem[]>(initialMovements);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Fish & Seafood");
  const [unit, setUnit] = useState("kg");
  const [qty, setQty] = useState("5.00");
  const [threshold, setThreshold] = useState("2.00");

  const [movIngredientId, setMovIngredientId] = useState(initialItems[0]?.id ?? "");
  const [movDelta, setMovDelta] = useState("-1.00");
  const [movReason, setMovReason] = useState("Service consumption");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleCreateIngredient(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !name.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const created = await api<IngredientItem>("/inventory/items", {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || "General",
          unit: unit.trim() || "kg",
          quantity_minor: Math.max(Math.round((Number.parseFloat(qty) || 0) * 100), 0),
          threshold_minor: Math.max(Math.round((Number.parseFloat(threshold) || 0) * 100), 0),
        }),
      });
      setItems((prev) => [...prev, created]);
      if (!movIngredientId) setMovIngredientId(created.id);
      setName("");
      setNotice(`Ingredient "${created.name}" added to inventory.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add ingredient.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRecordMovement(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !movIngredientId) return;
    const deltaMinor = Math.round((Number.parseFloat(movDelta) || 0) * 100);
    if (deltaMinor === 0) {
      setError("Enter a non-zero stock movement (+ for restock, - for usage/wastage).");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const headers = { "X-Restaurant-Id": restaurantId };
      const mov = await api<StockMovementItem>("/inventory/movements", {
        method: "POST",
        headers,
        body: JSON.stringify({
          ingredient_id: movIngredientId,
          delta_minor: deltaMinor,
          reason: movReason.trim() || "Stock adjustment",
        }),
      });
      const refreshedItems = await api<IngredientItem[]>("/inventory/items", { headers });
      setItems(refreshedItems);
      setMovements((prev) => [mov, ...prev]);
      setNotice("Stock movement recorded.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record movement.");
    } finally {
      setBusy(false);
    }
  }

  const nameById = Object.fromEntries(items.map((i) => [i.id, `${i.name} (${i.unit})`]));
  const inputClass =
    "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory & stock"
        description="Monitor kitchen ingredients, record stock movements and receive low-stock alerts"
      />

      {error && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm font-semibold text-success">
          {notice}
        </div>
      )}

      {canEdit && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Add kitchen ingredient">
            <form onSubmit={handleCreateIngredient} className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold">Ingredient name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Fresh Atlantic Salmon"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Initial stock</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Alert threshold</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Unit</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClass}>
                  <option value="kg">kg</option>
                  <option value="L">L</option>
                  <option value="pcs">pcs</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Add ingredient
                </button>
              </div>
            </form>
          </Card>

          <Card title="Record stock movement (+ restock / - usage)">
            <form onSubmit={handleRecordMovement} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold">Ingredient *</label>
                <select
                  value={movIngredientId}
                  onChange={(e) => setMovIngredientId(e.target.value)}
                  className={inputClass}
                >
                  {items.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({(ing.quantity_minor / 100).toFixed(2)} {ing.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Quantity delta (+ / -)</label>
                <input
                  type="number"
                  step="0.1"
                  value={movDelta}
                  onChange={(e) => setMovDelta(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Reason *</label>
                <input
                  required
                  type="text"
                  placeholder="Supplier delivery, dinner service, wastage..."
                  value={movReason}
                  onChange={(e) => setMovReason(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={busy || items.length === 0}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-4 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                >
                  Record movement
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <Card title="Kitchen inventory levels">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-muted-foreground">
                <th className="pb-3">Ingredient</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">Available</th>
                <th className="pb-3">Min. threshold</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No ingredients recorded yet.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-4 font-semibold text-primary">{item.name}</td>
                  <td className="py-4 text-muted-foreground">{item.category}</td>
                  <td className="py-4 font-semibold">
                    {(item.quantity_minor / 100).toFixed(2)} {item.unit}
                  </td>
                  <td className="py-4 text-muted-foreground">
                    {(item.threshold_minor / 100).toFixed(2)} {item.unit}
                  </td>
                  <td className="py-4">
                    <Badge tone={STATUS_TONE[item.stock_status] ?? "neutral"}>
                      {STATUS_LABEL[item.stock_status] ?? item.stock_status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {movements.length > 0 && (
        <Card title="Recent stock movements">
          <div className="divide-y divide-border text-xs">
            {movements.slice(0, 10).map((mov) => (
              <div key={mov.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  {mov.delta_minor >= 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-success" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-danger" />
                  )}
                  <span className="font-semibold">{nameById[mov.ingredient_id] ?? "Ingredient"}</span>
                  <span className="text-muted-foreground">· {mov.reason}</span>
                </div>
                <span className={`font-bold ${mov.delta_minor >= 0 ? "text-success" : "text-danger"}`}>
                  {mov.delta_minor >= 0 ? "+" : ""}
                  {(mov.delta_minor / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
