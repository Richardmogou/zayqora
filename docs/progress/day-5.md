# Day 5 — Reservations and Operations

The Day 5 baseline now covers public reservation requests with capacity checks, staff reservation management, a kitchen order board, and persistent in-app staff notifications. `frontend-b` remains the visual template; the working implementation is in `frontend` and `backend`.

## Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Tenant-scoped reservation CRUD and validated reservation status transitions | ✅ |
| 2 | Public availability by restaurant, local date and party size | ✅ |
| 3 | Availability uses restaurant opening hours, booking duration, interval, buffer, seat capacity and manual blocks | ✅ |
| 4 | Public booking rechecks capacity while holding the restaurant row lock; tenant-scoped idempotency protects retries | ✅ |
| 5 | Customer reservation form captures contact details and preferences and makes a pending request | ✅ |
| 6 | Workspace reservations page lists today's bookings, changes status, edits booking rules and manages manual blocks | ✅ |
| 7 | Kitchen staff can view active order tickets and move tickets into preparation and ready states | ✅ |
| 8 | Kitchen board shows items, modifiers, service mode, notes and elapsed time; it reconciles every 15 seconds | ✅ |
| 9 | Order and reservation events create deduplicated, per-staff in-app notifications; staff can mark them read | ✅ |
| 10 | Alembic has one head after merging the Day 4 integrity and Day 5 reservation branches | ✅ |
| 11 | Full backend suite, frontend TypeScript check and production build | ✅ — see verification below |

## How to check

- Public booking: `/r/{restaurant-slug}/reservations`
- Workspace reservations: `/reservations`
- Kitchen board: `/kitchen`
- Staff notifications: `/notifications`
- Backend check: `python -m pytest -q -p no:cacheprovider` from `backend`
- Frontend check: `npm.cmd run typecheck` from `frontend`
- Migration graph: `python -m alembic heads` from `backend`

## Implementation notes

- Reservation hours are stored per restaurant in its configured IANA timezone. Weekday keys use `0` for Monday through `6` for Sunday.
- The default schedule is Tuesday–Sunday, 12:00–14:30 and 19:00–22:00. Owners and managers can change hours, seat capacity, booking duration, interval and buffer from the reservations workspace.
- Capacity is an aggregate seat pool. Manual blocks cover closures and private events. The MVP does not assign individual tables or branches.
- In-app notifications are written in the same database transaction as the order or reservation change. The current delivery channel is the staff notification centre.
- Migration `0006_merge_day4_day5` joins the existing Day 4 integrity and Day 5 reservation heads. Migration `0007_day5_booking_notifications` adds capacity settings, blocks, idempotency and notifications.

## Known limitations

- Email, SMS, WhatsApp and browser-push delivery need a selected provider and worker configuration; they are not sent by this Day 5 baseline.
- The kitchen board polls every 15 seconds; it does not use WebSockets.
- Availability uses restaurant-wide seat capacity. Per-table capacities, branch-specific hours, special-event calendars and a customer-facing branch selector remain future work.
- The migration chain was rendered successfully in offline mode. Apply it to staging/production with `python -m alembic upgrade head` when deploying this code.

## Verification result

- Backend: **111 passed**, with one Starlette `httpx` deprecation warning.
- Frontend: `npm.cmd run typecheck` passed; `npm.cmd run build` passed. Next.js reports existing `<img>` optimization warnings.
- Alembic: `0007_day5_booking_notifications` is the sole head, and `python -m alembic upgrade head --sql` rendered successfully.
- Local development database: its Alembic marker said `0005_day5_reservations`, but inspection showed the physical schema still matched Day 1. After verifying the baseline columns, the marker was corrected to `0001_day1_baseline` and the full chain was applied. Existing Day 1 tables and data were retained; the expected Day 3–5 tables and reservation columns now exist.
