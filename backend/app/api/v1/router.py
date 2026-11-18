from fastapi import APIRouter

from app.api.v1 import auth, health, menu, notifications, orders, public, reservations, restaurants

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(restaurants.router)
api_router.include_router(menu.router)
api_router.include_router(public.router)
api_router.include_router(orders.router)
api_router.include_router(orders.public_router)
api_router.include_router(reservations.router)
api_router.include_router(reservations.members_router)
api_router.include_router(reservations.public_router)
api_router.include_router(notifications.router)
