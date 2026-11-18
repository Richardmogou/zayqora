# Day 3 — Public Website & Menu

The public restaurant storefront is live and the menu management module is operational. Customers can browse the restaurant page, explore the menu, customize dishes and proceed to checkout. Restaurant owners and managers can manage categories, items and availability through the workspace.

## Acceptance criteria covered

| Criterion | Status |
|---|---|
| `menu_categories`, `menu_items`, `modifier_groups`, `modifiers` tables created via Alembic migration | ✅ |
| `GET /api/v1/public/restaurants/{slug}` returns active restaurant profile | ✅ |
| `GET /api/v1/public/restaurants/{slug}/menu` returns published items only, grouped by category | ✅ |
| `POST/GET/PATCH/DELETE /api/v1/menu/categories` — owner/manager only, tenant-scoped | ✅ |
| `POST/GET/PATCH/DELETE /api/v1/menu/items` — owner/manager only, tenant-scoped | ✅ |
| `PATCH /api/v1/menu/items/{id}/availability` — owner, manager and kitchen roles | ✅ |
| Cross-tenant item/category access returns `404` | ✅ |
| Public menu hides draft and unavailable items | ✅ |
| Suspended restaurant returns `404` on public endpoints | ✅ |
| All mutations write audit log entries | ✅ |
| `/r/[slug]` storefront home page | ✅ |
| `/r/[slug]/menu` public menu with category filters and search | ✅ |
| `/r/[slug]/menu/[item]` dish detail with variants, extras, quantity and instructions | ✅ |
| `/r/[slug]/cart` cart with quantity controls, promo code and delivery mode | ✅ |
| `/r/[slug]/checkout` checkout with contact, service mode, payment and order summary | ✅ |
| `/menu` workspace menu management (categories, items, availability toggle) | ✅ |
| `/menu/new` create item form (name, description, category, price, tax, prep time, allergens) | ✅ |
| Automated tests: 16 menu tests (categories, items, availability, public, cross-tenant) | ✅ |

---

## New API endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/public/restaurants/{slug}` | Public restaurant profile |
| `GET` | `/api/v1/public/restaurants/{slug}/menu` | Published public menu |
| `GET/POST` | `/api/v1/menu/categories` | List / create categories |
| `DELETE` | `/api/v1/menu/categories/{id}` | Delete category |
| `GET/POST` | `/api/v1/menu/items` | List / create items |
| `GET/PATCH/DELETE` | `/api/v1/menu/items/{id}` | Get / update / delete item (records price changes in audit log) |
| `PATCH` | `/api/v1/menu/items/{id}/availability` | Toggle availability |
| `POST` | `/api/v1/menu/images` | Upload and validate dish image (PNG, JPEG, WebP up to 2 MB) |
| `GET` | `/api/v1/public/uploads/{restaurant_id}/{filename}` | Serve validated dish image with `nosniff` header |

---

## Frontend pages added

| Route | Description |
|---|---|
| `/r/[slug]` | Storefront home — hero, featured/popular dishes, hours, order CTA |
| `/r/[slug]/menu` | Public menu — category filters, search, sorting, dietary badges, discounted prices, allergen notice |
| `/r/[slug]/menu/[item]` | Dish detail — image, variants, extras, quantity, dietary/allergen info, add to cart |
| `/r/[slug]/cart` | Cart — item list, promo code, delivery mode, total |
| `/r/[slug]/checkout` | Checkout — contact, service mode, payment, confirm |
| `/menu` | Workspace menu management (category reorder/rename/archive/delete, item list, public preview) |
| `/menu/new` | Create / edit menu item form (image upload, discounted price, featured toggle, station, dietary tags, variants) |
