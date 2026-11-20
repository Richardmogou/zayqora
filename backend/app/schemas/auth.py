from datetime import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=16, max_length=256)
    new_password: str = Field(min_length=8, max_length=256)


class PasswordResetStatusOut(BaseModel):
    status: str = "ok"
    reset_token: str | None = None


class VerifyEmailIn(BaseModel):
    token: str = Field(min_length=16, max_length=256)


class EmailVerificationStatusOut(BaseModel):
    status: str = "ok"
    verified: bool = False
    verification_token: str | None = None


class ContactMessageIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=40)
    message: str = Field(min_length=5, max_length=2000)


class PublicRestaurantDirectoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    slug: str
    name: str
    updated_at: datetime | None = None


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)
    restaurant_name: str = Field(min_length=2, max_length=200)
    country: str = Field(default="US", min_length=2, max_length=2)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    timezone: str = Field(default="UTC", max_length=64)


class RestaurantUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    country: str | None = Field(default=None, min_length=2, max_length=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    timezone: str | None = Field(default=None, max_length=64)
    status: Literal["pending", "active"] | None = None
    tagline: str | None = Field(default=None, max_length=240)
    description: str | None = Field(default=None, max_length=4000)
    cuisine: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=40)
    contact_email: EmailStr | None = None
    address: str | None = Field(default=None, max_length=300)
    logo_url: str | None = Field(default=None, max_length=500)
    cover_image_url: str | None = Field(default=None, max_length=500)
    delivery_fee_minor: int | None = Field(default=None, ge=0, le=100000)
    tax_rate_bps: int | None = Field(default=None, ge=0, le=5000)
    privacy_policy: str | None = Field(default=None, max_length=10000)
    terms_of_service: str | None = Field(default=None, max_length=10000)
    refund_policy: str | None = Field(default=None, max_length=10000)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    full_name: str
    is_platform_admin: bool
    email_verified_at: datetime | None = None


class MembershipOut(BaseModel):
    restaurant_id: uuid.UUID
    restaurant_name: str
    restaurant_slug: str
    restaurant_status: str
    role: str


class MeOut(BaseModel):
    user: UserOut
    memberships: list[MembershipOut]


class RestaurantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    slug: str
    name: str
    status: str
    plan: str = "growth"
    country: str
    currency: str
    timezone: str
    tagline: str | None = None
    description: str | None = None
    cuisine: str | None = None
    phone: str | None = None
    contact_email: str | None = None
    address: str | None = None
    logo_url: str | None = None
    cover_image_url: str | None = None
    delivery_fee_minor: int = 400
    tax_rate_bps: int = 1000
    privacy_policy: str | None = None
    terms_of_service: str | None = None
    refund_policy: str | None = None
    reservation_opening_hours: dict | None = None
