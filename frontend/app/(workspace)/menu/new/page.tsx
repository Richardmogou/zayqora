"use client";
import { Suspense, useEffect, useState, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ImagePlus, Plus, Star, Trash2, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";

interface Category {
  id: string;
  name: string;
}

interface ModifierDraft {
  name: string;
  price_delta_major: string;
  is_default: boolean;
}

interface ModifierGroupDraft {
  name: string;
  required: boolean;
  multi_select: boolean;
  modifiers: ModifierDraft[];
}

interface MenuItemDetail {
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
  modifier_groups: {
    name: string;
    required: boolean;
    multi_select: boolean;
    modifiers: { name: string; price_delta_minor: number; is_default: boolean }[];
  }[];
}

const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Halal", "Gluten-Free", "Dairy-Free"];
const PRESET_IMAGES = [
  { label: "Salad", url: "/images/dish-salad-native.png" },
  { label: "Salmon", url: "/images/dish-salmon-native.png" },
  { label: "Dessert", url: "/images/dish-tart-native.png" },
];
const KITCHEN_STATIONS = [
  "Hot Kitchen / Grill",
  "Cold Station / Salads",
  "Pastry & Desserts",
  "Bar & Beverages",
];

function MenuItemForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemId = searchParams.get("id");

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [price, setPrice] = useState("24.00");
  const [discountedPrice, setDiscountedPrice] = useState("");
  const [taxRate, setTaxRate] = useState("10");
  const [prepTime, setPrepTime] = useState("15");
  const [kitchenStation, setKitchenStation] = useState(KITCHEN_STATIONS[0]);
  const [allergens, setAllergens] = useState("");
  const [dietaryTags, setDietaryTags] = useState<string[]>([]);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroupDraft[]>([]);

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const me = await api<{ memberships: { restaurant_id: string }[] }>("/auth/me");
        const membership = me.memberships[0];
        if (!membership || !active) return;
        const headers = { "X-Restaurant-Id": membership.restaurant_id };
        setRestaurantId(membership.restaurant_id);
        const cats = await api<Category[]>("/menu/categories", { headers });
        if (!active) return;
        setCategories(cats);
        if (cats[0]) setCategoryId(cats[0].id);

        if (itemId) {
          const item = await api<MenuItemDetail>(`/menu/items/${itemId}`, { headers });
          if (!active) return;
          setName(item.name);
          setDescription(item.description ?? "");
          setImageUrl(item.image_url ?? "");
          setCategoryId(item.category_id);
          setPrice((item.price_minor / 100).toFixed(2));
          setDiscountedPrice(
            item.discounted_price_minor != null ? (item.discounted_price_minor / 100).toFixed(2) : ""
          );
          setTaxRate(item.tax_rate || "10");
          setPrepTime(item.prep_time_minutes ? String(item.prep_time_minutes) : "15");
          setKitchenStation(item.kitchen_station || KITCHEN_STATIONS[0]);
          setAllergens(item.allergens ?? "");
          setDietaryTags(
            item.dietary_tags
              ? item.dietary_tags.split(",").map((tag) => tag.trim()).filter(Boolean)
              : []
          );
          setIsFeatured(Boolean(item.is_featured));
          setIsAvailable(item.is_available);
          setModifierGroups(
            item.modifier_groups.map((g) => ({
              name: g.name,
              required: g.required,
              multi_select: g.multi_select,
              modifiers: g.modifiers.map((m) => ({
                name: m.name,
                price_delta_major: (m.price_delta_minor / 100).toFixed(2),
                is_default: m.is_default,
              })),
            }))
          );
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load menu editor.");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [itemId]);

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !restaurantId) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Only PNG, JPEG or WebP images are supported.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image file must be 2 MB or smaller.");
      return;
    }
    setUploadingImage(true);
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Could not read image file"));
        reader.readAsDataURL(file);
      });
      const uploaded = await api<{ image_url: string }>("/menu/images", {
        method: "POST",
        headers: { "X-Restaurant-Id": restaurantId },
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type,
          data_base64: dataUrl,
        }),
      });
      setImageUrl(uploaded.image_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload image.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  function toggleDietaryTag(tag: string) {
    setDietaryTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  }

  function addGroup() {
    setModifierGroups((prev) => [
      ...prev,
      {
        name: "Size / Option",
        required: false,
        multi_select: false,
        modifiers: [{ name: "Standard", price_delta_major: "0.00", is_default: true }],
      },
    ]);
  }

  function removeGroup(index: number) {
    setModifierGroups((prev) => prev.filter((_, idx) => idx !== index));
  }

  function addModifier(groupIndex: number) {
    setModifierGroups((prev) =>
      prev.map((group, idx) =>
        idx === groupIndex
          ? {
              ...group,
              modifiers: [...group.modifiers, { name: "", price_delta_major: "0.00", is_default: false }],
            }
          : group
      )
    );
  }

  function removeModifier(groupIndex: number, modIndex: number) {
    setModifierGroups((prev) =>
      prev.map((group, idx) =>
        idx === groupIndex
          ? { ...group, modifiers: group.modifiers.filter((_, mIdx) => mIdx !== modIndex) }
          : group
      )
    );
  }

  async function handleSave(mode: "draft" | "published") {
    if (!restaurantId) return;
    if (!name.trim()) {
      setError("Item name is required.");
      return;
    }
    const parsedPrice = Number.parseFloat(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError("Enter a valid non-negative price.");
      return;
    }
    const priceMinor = Math.round(parsedPrice * 100);
    let discountedMinor: number | null = null;
    if (discountedPrice.trim()) {
      const parsedDiscount = Number.parseFloat(discountedPrice);
      if (Number.isNaN(parsedDiscount) || parsedDiscount < 0 || Math.round(parsedDiscount * 100) >= priceMinor) {
        setError("Discounted price must be non-negative and lower than the base price.");
        return;
      }
      discountedMinor = Math.round(parsedDiscount * 100);
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const headers = { "X-Restaurant-Id": restaurantId };
      let targetCategoryId = categoryId;
      if (!targetCategoryId || newCategoryName.trim()) {
        const catName = newCategoryName.trim() || "Main courses";
        const createdCat = await api<Category>("/menu/categories", {
          method: "POST",
          headers,
          body: JSON.stringify({ name: catName, position: categories.length }),
        });
        targetCategoryId = createdCat.id;
      }

      const parsedPrep = Number.parseInt(prepTime, 10);
      const payload = {
        category_id: targetCategoryId,
        name: name.trim(),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
        price_minor: priceMinor,
        discounted_price_minor: discountedMinor,
        tax_rate: taxRate,
        prep_time_minutes: !Number.isNaN(parsedPrep) && parsedPrep > 0 ? parsedPrep : null,
        kitchen_station: kitchenStation || null,
        allergens: allergens.trim() || null,
        dietary_tags: dietaryTags.length > 0 ? dietaryTags.join(",") : null,
        is_featured: isFeatured,
        is_available: isAvailable,
        is_published: mode === "published",
        modifier_groups: modifierGroups
          .filter((g) => g.name.trim())
          .map((g, gIdx) => ({
            name: g.name.trim(),
            required: g.required,
            multi_select: g.multi_select,
            position: gIdx,
            modifiers: g.modifiers
              .filter((m) => m.name.trim())
              .map((m, mIdx) => ({
                name: m.name.trim(),
                price_delta_minor: Math.round((Number.parseFloat(m.price_delta_major) || 0) * 100),
                is_default: m.is_default,
                position: mIdx,
              })),
          })),
      };

      if (itemId) {
        await api(`/menu/items/${itemId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        });
      } else {
        await api("/menu/items", {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
      }

      setNotice(mode === "published" ? "Item published to your restaurant menu." : "Item saved as draft.");
      router.push("/menu");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save menu item.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "h-10 w-full rounded-xl border border-border bg-card px-3.5 text-sm focus:border-primary focus:outline-none";
  const selectClass = "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none";

  return (
    <div className="space-y-6">
      <PageHeader
        title={itemId ? "Edit menu item" : "Create an item"}
        description="Add or update a dish, beverage and customization options"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave("draft")}
              className="rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold transition hover:bg-muted/40 disabled:opacity-50"
            >
              Save as draft
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave("published")}
              className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Publish"}
            </button>
          </div>
        }
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

      <div className="grid gap-6 lg:grid-cols-12">
        <Card title="General information" className="lg:col-span-7">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold">Name *</label>
              <input
                type="text"
                placeholder="Item name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold">Description</label>
              <textarea
                rows={4}
                placeholder="Item description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-border bg-card p-3.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Category</label>
                {categories.length > 0 ? (
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectClass}>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="New category name (e.g. Main courses)"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className={inputClass}
                  />
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Or create new category</label>
                <input
                  type="text"
                  placeholder="Optional new category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="block text-xs font-semibold">Dish photo (PNG, JPEG or WebP — max 2 MB)</label>
              <div className="flex flex-wrap items-start gap-4">
                {imageUrl ? (
                  <div className="relative h-28 w-40 overflow-hidden rounded-xl border border-border bg-muted/20">
                    <img src={imageUrl} alt={name || "Dish preview"} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="absolute right-1.5 top-1.5 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-semibold text-white hover:bg-black"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="grid h-28 w-40 place-items-center rounded-xl border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
                    <div className="flex flex-col items-center gap-1">
                      <ImagePlus className="h-5 w-5" />
                      <span>No image</span>
                    </div>
                  </div>
                )}

                <div className="flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{uploadingImage ? "Uploading..." : "Upload image file"}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={uploadingImage}
                        onChange={(e) => void handleFileSelect(e)}
                        className="hidden"
                      />
                    </label>
                    {PRESET_IMAGES.map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => setImageUrl(preset.url)}
                        className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted/40"
                      >
                        Use {preset.label} photo
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Or paste image URL (e.g. /images/dish-salmon-native.png)"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-5">
          <Card title="Pricing, promotion & taxes">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Base price *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="24.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Discounted price</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Optional"
                  value={discountedPrice}
                  onChange={(e) => setDiscountedPrice(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Tax rate (%)</label>
                <select value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className={selectClass}>
                  <option value="10">10% VAT (Dine-in)</option>
                  <option value="5.5">5.5% VAT (Takeaway)</option>
                  <option value="20">20% Standard VAT</option>
                  <option value="0">0% Exempt</option>
                </select>
              </div>
            </div>
            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Star className="h-3.5 w-3.5 text-amber-500" />
              Feature this dish on the restaurant homepage and top of menu
            </label>
          </Card>

          <Card title="Preparation, station & dietary">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Prep time (min)</label>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Kitchen station</label>
                <select value={kitchenStation} onChange={(e) => setKitchenStation(e.target.value)} className={selectClass}>
                  {KITCHEN_STATIONS.map((station) => (
                    <option key={station} value={station}>
                      {station}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Stock state</label>
                <select
                  value={isAvailable ? "available" : "unavailable"}
                  onChange={(e) => setIsAvailable(e.target.value === "available")}
                  className={selectClass}
                >
                  <option value="available">Available</option>
                  <option value="unavailable">Sold out / Unavailable</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold">Verified dietary labels</label>
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map((tag) => {
                  const active = dietaryTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleDietaryTag(tag)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold">Allergens</label>
              <input
                type="text"
                placeholder="e.g. Fish, Dairy, Gluten"
                value={allergens}
                onChange={(e) => setAllergens(e.target.value)}
                className={inputClass}
              />
            </div>
          </Card>
        </div>
      </div>

      <Card title="Variants & add-ons">
        <div className="space-y-4">
          {modifierGroups.map((group, gIdx) => (
            <div key={gIdx} className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <input
                  type="text"
                  placeholder="Group name (e.g. Size, Side dish, Extras)"
                  value={group.name}
                  onChange={(e) =>
                    setModifierGroups((prev) =>
                      prev.map((entry, idx) => (idx === gIdx ? { ...entry, name: e.target.value } : entry))
                    )
                  }
                  className="h-9 w-64 rounded-lg border border-border bg-card px-3 text-sm"
                />
                <div className="flex items-center gap-4 text-xs">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={group.required}
                      onChange={(e) =>
                        setModifierGroups((prev) =>
                          prev.map((entry, idx) => (idx === gIdx ? { ...entry, required: e.target.checked } : entry))
                        )
                      }
                    />
                    Required
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={group.multi_select}
                      onChange={(e) =>
                        setModifierGroups((prev) =>
                          prev.map((entry, idx) => (idx === gIdx ? { ...entry, multi_select: e.target.checked } : entry))
                        )
                      }
                    />
                    Multi-select
                  </label>
                  <button
                    type="button"
                    onClick={() => removeGroup(gIdx)}
                    className="inline-flex items-center gap-1 text-danger hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove group
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {group.modifiers.map((mod, mIdx) => (
                  <div key={mIdx} className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      placeholder="Option name"
                      value={mod.name}
                      onChange={(e) =>
                        setModifierGroups((prev) =>
                          prev.map((entry, idx) =>
                            idx === gIdx
                              ? {
                                  ...entry,
                                  modifiers: entry.modifiers.map((m, i) =>
                                    i === mIdx ? { ...m, name: e.target.value } : m
                                  ),
                                }
                              : entry
                          )
                        )
                      }
                      className="h-9 flex-1 rounded-lg border border-border bg-card px-3 text-xs"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="+0.00"
                      value={mod.price_delta_major}
                      onChange={(e) =>
                        setModifierGroups((prev) =>
                          prev.map((entry, idx) =>
                            idx === gIdx
                              ? {
                                  ...entry,
                                  modifiers: entry.modifiers.map((m, i) =>
                                    i === mIdx ? { ...m, price_delta_major: e.target.value } : m
                                  ),
                                }
                              : entry
                          )
                        )
                      }
                      className="h-9 w-28 rounded-lg border border-border bg-card px-3 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeModifier(gIdx, mIdx)}
                      className="text-xs text-danger hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addModifier(gIdx)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Add option
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addGroup}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-xs font-semibold transition hover:bg-muted/50"
          >
            <Plus className="h-4 w-4" /> Add a variant or add-on group
          </button>
        </div>
      </Card>
    </div>
  );
}

export default function NewMenuItemPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading editor...</div>}>
      <MenuItemForm />
    </Suspense>
  );
}
