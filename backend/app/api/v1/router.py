from fastapi import APIRouter

from app.api.v1 import (
    auth,
    customers,
    health,
    menu,
    notifications,
    operations,
    orders,
    platform,
    public,
    release2,
    reports,
    reservations,
    restaurants,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(restaurants.router)
api_router.include_router(operations.branches_router)
api_router.include_router(menu.router)
api_router.include_router(public.router)
api_router.include_router(operations.cart_router)
api_router.include_router(operations.coupons_router)
api_router.include_router(orders.router)
api_router.include_router(orders.public_router)
api_router.include_router(operations.payments_router)
api_router.include_router(reservations.router)
api_router.include_router(reservations.members_router)
api_router.include_router(reservations.public_router)
api_router.include_router(notifications.router)
api_router.include_router(operations.inventory_router)
api_router.include_router(operations.reviews_router)
api_router.include_router(operations.public_reviews_router)
api_router.include_router(release2.tables_router)
api_router.include_router(release2.public_tables_router)
api_router.include_router(release2.kitchen_router)
api_router.include_router(release2.pos_router)
api_router.include_router(release2.deliveries_router)
api_router.include_router(release2.expenses_router)
api_router.include_router(release2.ws_router)
api_router.include_router(reports.router)
api_router.include_router(customers.router)
api_router.include_router(platform.router)
