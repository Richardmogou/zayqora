import csv
import io
from collections import defaultdict
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import AuditLog, Order, OrderLine, Reservation
from app.permissions.deps import TenantContext, require_roles
from app.permissions.roles import Role
from app.schemas.reports import BreakdownOut, DailySalesPointOut, SalesReportOut, TopItemOut

router = APIRouter(prefix="/reports", tags=["reports"])

_FINANCE_ROLES = (Role.OWNER, Role.MANAGER, Role.ACCOUNTANT)


def _resolve_tz(tz_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def _compute_sales_report(db: Session, ctx: TenantContext, period: str) -> SalesReportOut:
    restaurant = ctx.restaurant
    tz = _resolve_tz(restaurant.timezone)
    today_local = datetime.now(timezone.utc).astimezone(tz).date()

    if period == "today":
        days_count = 1
    elif period == "30d":
        days_count = 30
    else:
        period = "7d"
        days_count = 7

    start_day = today_local - timedelta(days=days_count - 1)
    start_utc = datetime.combine(start_day, time.min, tz).astimezone(timezone.utc)
    end_utc = datetime.combine(today_local + timedelta(days=1), time.min, tz).astimezone(timezone.utc)

    orders = db.scalars(
        select(Order).where(
            Order.restaurant_id == restaurant.id,
            Order.created_at >= start_utc,
            Order.created_at < end_utc,
        )
    ).all()

    valid_orders = [o for o in orders if o.status != "cancelled"]
    cancelled_orders = [o for o in orders if o.status == "cancelled"]

    gross_sales = sum(o.total_minor for o in valid_orders)
    delivery_fees = sum(o.delivery_fee_minor for o in valid_orders)
    subtotal_sum = sum(o.subtotal_minor for o in valid_orders)
    estimated_tax = round(subtotal_sum * 0.10)
    net_sales = max(gross_sales - delivery_fees - estimated_tax, 0)
    cancelled_minor = sum(o.total_minor for o in cancelled_orders)
    avg_order_value = round(gross_sales / len(valid_orders)) if valid_orders else 0

    reservations = db.scalars(
        select(Reservation).where(
            Reservation.restaurant_id == restaurant.id,
            Reservation.reserved_at >= start_utc,
            Reservation.reserved_at < end_utc,
            Reservation.status.in_(["confirmed", "seated", "completed"]),
        )
    ).all()
    covers_served = sum(r.guests for r in reservations)

    daily_orders_map: dict[str, int] = defaultdict(int)
    daily_sales_map: dict[str, int] = defaultdict(int)
    payment_map: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    mode_map: dict[str, list[int]] = defaultdict(lambda: [0, 0])

    for order in valid_orders:
        created_at = order.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        day_iso = created_at.astimezone(tz).date().isoformat()
        daily_orders_map[day_iso] += 1
        daily_sales_map[day_iso] += order.total_minor

        payment_map[order.payment_method][0] += 1
        payment_map[order.payment_method][1] += order.total_minor

        mode_map[order.service_mode][0] += 1
        mode_map[order.service_mode][1] += order.total_minor

    daily_series: list[DailySalesPointOut] = []
    for offset in range(days_count):
        day = start_day + timedelta(days=offset)
        day_iso = day.isoformat()
        label = day.strftime("%a") if days_count <= 7 else day.strftime("%d %b")
        daily_series.append(
            DailySalesPointOut(
                date=day_iso,
                label=label,
                orders_count=daily_orders_map[day_iso],
                gross_sales_minor=daily_sales_map[day_iso],
            )
        )

    valid_ids = [o.id for o in valid_orders]
    item_agg: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    if valid_ids:
        lines = db.scalars(select(OrderLine).where(OrderLine.order_id.in_(valid_ids))).all()
        for line in lines:
            item_agg[line.name][0] += line.quantity
            item_agg[line.name][1] += line.line_total_minor

    top_items = [
        TopItemOut(name=name, quantity=vals[0], revenue_minor=vals[1])
        for name, vals in sorted(item_agg.items(), key=lambda x: (x[1][1], x[1][0]), reverse=True)[:5]
    ]

    by_payment = [
        BreakdownOut(key=k, count=v[0], total_minor=v[1])
        for k, v in sorted(payment_map.items(), key=lambda x: x[1][1], reverse=True)
    ]
    by_mode = [
        BreakdownOut(key=k, count=v[0], total_minor=v[1])
        for k, v in sorted(mode_map.items(), key=lambda x: x[1][1], reverse=True)
    ]

    return SalesReportOut(
        period=period,
        currency=restaurant.currency,
        timezone=restaurant.timezone,
        orders_count=len(valid_orders),
        cancelled_orders_count=len(cancelled_orders),
        gross_sales_minor=gross_sales,
        net_sales_minor=net_sales,
        delivery_fees_minor=delivery_fees,
        estimated_tax_minor=estimated_tax,
        cancelled_minor=cancelled_minor,
        average_order_value_minor=avg_order_value,
        covers_served=covers_served,
        daily_series=daily_series,
        top_items=top_items,
        by_payment_method=by_payment,
        by_service_mode=by_mode,
    )


@router.get("/sales", response_model=SalesReportOut)
def get_sales_report(
    period: str = Query(default="7d", pattern="^(today|7d|30d)$"),
    ctx: TenantContext = Depends(require_roles(*_FINANCE_ROLES)),
    db: Session = Depends(get_db),
):
    return _compute_sales_report(db, ctx, period)


@router.get("/sales/export")
def export_sales_csv(
    period: str = Query(default="7d", pattern="^(today|7d|30d)$"),
    ctx: TenantContext = Depends(require_roles(*_FINANCE_ROLES)),
    db: Session = Depends(get_db),
):
    report = _compute_sales_report(db, ctx, period)
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="report.sales.export",
        entity_type="restaurant",
        entity_id=str(ctx.restaurant.id),
        data={"period": period, "currency": report.currency},
    ))
    db.commit()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["ZAYQORA Sales Report", ctx.restaurant.name])
    writer.writerow(["Period", report.period, "Currency", report.currency, "Timezone", report.timezone])
    writer.writerow([])
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Orders count", report.orders_count])
    writer.writerow(["Cancelled orders", report.cancelled_orders_count])
    writer.writerow(["Gross sales", f"{report.gross_sales_minor / 100:.2f}"])
    writer.writerow(["Net sales", f"{report.net_sales_minor / 100:.2f}"])
    writer.writerow(["Delivery fees", f"{report.delivery_fees_minor / 100:.2f}"])
    writer.writerow(["Estimated tax", f"{report.estimated_tax_minor / 100:.2f}"])
    writer.writerow(["Average order value", f"{report.average_order_value_minor / 100:.2f}"])
    writer.writerow(["Covers served", report.covers_served])
    writer.writerow([])
    writer.writerow(["Date", "Orders", f"Gross sales ({report.currency})"])
    for point in report.daily_series:
        writer.writerow([point.date, point.orders_count, f"{point.gross_sales_minor / 100:.2f}"])

    filename = f"sales-report-{ctx.restaurant.slug}-{report.period}.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
