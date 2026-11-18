import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartLine {
  /** Composite key: menu_item_id + sorted modifier ids */
  cart_key: string;
  menu_item_id: string;
  name: string;
  unit_price_minor: number;
  quantity: number;
  modifier_ids: string[];
  modifiers_snapshot: { name: string; price_delta_minor: number }[] | null;
  line_total_minor: number;
  description?: string;
}

/** Build a stable cart key from item id + selected modifier ids */
export function cartKey(menu_item_id: string, modifier_ids: string[]): string {
  return [menu_item_id, ...[...modifier_ids].sort()].join("|");
}

interface CartState {
  slug: string;
  lines: CartLine[];
  addLine: (slug: string, line: CartLine) => void;
  updateQty: (cart_key: string, delta: number) => void;
  removeLine: (cart_key: string) => void;
  clearCart: (slug: string) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      slug: "",
      lines: [],

      addLine: (slug, line) =>
        set((state) => {
          const base = state.slug === slug ? state.lines : [];
          const existing = base.findIndex((l) => l.cart_key === line.cart_key);
          if (existing >= 0) {
            const updated = [...base];
            const prev = updated[existing];
            updated[existing] = {
              ...prev,
              quantity: prev.quantity + line.quantity,
              line_total_minor: prev.unit_price_minor * (prev.quantity + line.quantity),
            };
            return { slug, lines: updated };
          }
          return { slug, lines: [...base, line] };
        }),

      updateQty: (cart_key, delta) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.cart_key === cart_key
              ? { ...l, quantity: Math.max(1, l.quantity + delta), line_total_minor: l.unit_price_minor * Math.max(1, l.quantity + delta) }
              : l
          ),
        })),

      removeLine: (cart_key) =>
        set((state) => ({ lines: state.lines.filter((l) => l.cart_key !== cart_key) })),

      clearCart: (slug) => set({ slug, lines: [] }),
    }),
    { name: "zayqora-cart" }
  )
);
