"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { useCartStore, cartKey } from "@/lib/cart-store";

interface Modifier { id: string; name: string; price_delta_minor: number; is_default: boolean; }
interface ModifierGroup { id: string; name: string; required: boolean; multi_select: boolean; modifiers: Modifier[]; }
interface Dish {
  id: string;
  name: string;
  description: string | null;
  price_minor: number;
  discounted_price_minor?: number | null;
  is_available: boolean;
  modifier_groups: ModifierGroup[];
}

export default function DishCustomizer({ dish, cartHref, slug }: { dish: Dish; cartHref: string; slug: string }) {
  const router = useRouter();
  const addLine = useCartStore((s) => s.addLine);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [instructions, setInstructions] = useState("");
  const [selectionError, setSelectionError] = useState("");

  function toggle(groupId: string, modId: string, multi: boolean) {
    setSelections((prev) => {
      const current = prev[groupId] ?? [];
      if (multi) {
        return { ...prev, [groupId]: current.includes(modId) ? current.filter((x) => x !== modId) : [...current, modId] };
      }
      return { ...prev, [groupId]: current[0] === modId ? [] : [modId] };
    });
  }

  const selectedMods = dish.modifier_groups.flatMap((g) =>
    g.modifiers.filter((m) => (selections[g.id] ?? []).includes(m.id))
  );
  const selectedModIds = selectedMods.map((m) => m.id);
  const modifierTotal = selectedMods.reduce((a, m) => a + m.price_delta_minor, 0);
  const basePrice = dish.discounted_price_minor ?? dish.price_minor;
  const unitTotal = basePrice + modifierTotal;
  const total = (unitTotal * qty) / 100;

  function handleAddToCart() {
    const missingGroup = dish.modifier_groups.find(
      (group) => group.required && !(selections[group.id]?.length)
    );
    if (missingGroup) {
      setSelectionError(`Choose an option for ${missingGroup.name}.`);
      return;
    }
    setSelectionError("");
    const key = cartKey(dish.id, selectedModIds);
    addLine(slug, {
      cart_key: key,
      menu_item_id: dish.id,
      name: dish.name,
      unit_price_minor: unitTotal,
      quantity: qty,
      modifier_ids: selectedModIds,
      modifiers_snapshot: selectedMods.length > 0
        ? selectedMods.map((m) => ({ name: m.name, price_delta_minor: m.price_delta_minor }))
        : null,
      line_total_minor: unitTotal * qty,
      description: dish.description ?? undefined,
    });
    router.push(cartHref);
  }

  return (
    <div className="space-y-4 lg:col-span-6">
      {dish.modifier_groups.map((group) => (
        <div key={group.id} className="rounded-2xl border border-border bg-[#EFF4F0] p-5">
          <h2 className="text-sm font-bold text-[#0B2A22]">
            {group.name}
            {group.required && <span className="ml-2 text-xs font-normal text-red-500">required</span>}
          </h2>
          <div className="mt-3 space-y-2.5">
            {group.modifiers.map((mod) => {
              const selected = (selections[group.id] ?? []).includes(mod.id);
              return (
                <label key={mod.id} className="flex cursor-pointer items-center justify-between text-sm text-[#0B2A22]">
                  <span className="flex items-center gap-3">
                    <input
                      type={group.multi_select ? "checkbox" : "radio"}
                      name={group.id}
                      checked={selected}
                      onChange={() => toggle(group.id, mod.id, group.multi_select)}
                      className="h-4 w-4 rounded border-slate-400"
                    />
                    {mod.name}
                  </span>
                  {mod.price_delta_minor !== 0 && (
                    <span className="font-semibold">+ &euro;{(mod.price_delta_minor / 100).toFixed(2)}</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-12">
        <div className="rounded-2xl border border-border bg-[#EFF4F0] p-4 sm:col-span-5">
          <p className="text-xs font-bold text-[#0B2A22]">Quantity</p>
          <div className="mt-2.5 flex items-center justify-between rounded-xl border border-border bg-white px-3 py-2">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-1 text-[#0B2A22] hover:text-[#C4933F]"><Minus className="h-4 w-4" /></button>
            <span className="text-lg font-bold text-[#0B2A22]">{qty}</span>
            <button type="button" onClick={() => setQty((q) => q + 1)} className="p-1 text-[#0B2A22] hover:text-[#C4933F]"><Plus className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-[#EFF4F0] p-4 sm:col-span-7">
          <p className="text-xs font-bold text-[#0B2A22]">Special instructions <span className="text-[11px] font-normal text-slate-500">(optional)</span></p>
          <input type="text" placeholder="E.g.: no salt, well done..." value={instructions} onChange={(e) => setInstructions(e.target.value)}
            className="mt-2.5 h-11 w-full rounded-xl border border-border bg-white px-3.5 text-xs text-[#0B2A22] focus:outline-none" />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-[#CBE0D5] bg-[#E1EFE7] px-6 py-4">
        <div className="flex items-baseline gap-6">
          <span className="text-lg font-bold text-[#0B2A22]">Total</span>
          <span className="text-3xl font-extrabold text-[#C4933F]">&euro;{total.toFixed(2)}</span>
        </div>
        <button
          type="button"
          disabled={!dish.is_available}
          onClick={handleAddToCart}
          className="inline-flex items-center gap-2.5 rounded-xl bg-[#0B2A22] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[#163F34] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShoppingCart className="h-4 w-4" /> Add to cart
        </button>
      </div>
      {selectionError && <p role="alert" className="text-sm font-medium text-red-600">{selectionError}</p>}
    </div>
  );
}
