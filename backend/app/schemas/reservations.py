import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field

RESERVATION_STATUSES = {"pending", "confirmed", "seated", "completed", "cancelled", "no_show"}

RESERVATION_TRANSITIONS: dict[str, set[str]] = {
    "pending":   {"confirmed", "cancelled"},
    "confirmed": {"seated", "cancelled", "no_show"},
    "seated":    {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
    "no_show":   set(),
}


class ReservationIn(BaseModel):
    customer_name: str = Field(min_length=1, max_length=200)
    customer_phone: str | None = Field(default=None, max_length=30)
    customer_email: str | None = Field(default=None, max_length=320)
    guests: int = Field(ge=1, le=100)
    table_label: str | None = Field(default=None, max_length=50)
    reserved_at: datetime
    notes: str | None = None


class ReservationUpdateIn(BaseModel):
    customer_name: str | None = Field(default=None, min_length=1, max_length=200)
    customer_phone: str | None = Field(default=None, max_length=30)
    customer_email: str | None = Field(default=None, max_length=320)
    guests: int | None = Field(default=None, ge=1, le=100)
    table_label: str | None = Field(default=None, max_length=50)
    reserved_at: datetime | None = None
    notes: str | None = None


class PublicReservationIn(ReservationIn):
    idempotency_key: str | None = Field(default=None, max_length=64)
    customer_email: EmailStr | None = None


class ReservationSlotOut(BaseModel):
    starts_at: datetime
    remaining_guests: int


class ReservationAvailabilityOut(BaseModel):
    date: str
    timezone: str
    slots: list[ReservationSlotOut]


class ReservationSettingsIn(BaseModel):
    capacity: int = Field(ge=1, le=500)
    duration_minutes: int = Field(ge=30, le=240)
    slot_interval_minutes: int = Field(ge=15, le=120)
    buffer_minutes: int = Field(ge=0, le=60)
    opening_hours: dict[str, list[tuple[str, str]]]


class ReservationSettingsOut(ReservationSettingsIn):
    pass


class ReservationBlockIn(BaseModel):
    starts_at: datetime
    ends_at: datetime
    reason: str | None = Field(default=None, max_length=200)


class ReservationBlockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    restaurant_id: uuid.UUID
    starts_at: datetime
    ends_at: datetime
    reason: str | None
    created_at: datetime


class ReservationStatusIn(BaseModel):
    status: str


class ReservationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    restaurant_id: uuid.UUID
    customer_name: str
    customer_phone: str | None
    customer_email: str | None
    guests: int
    table_label: str | None
    reserved_at: datetime
    notes: str | None
    status: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Team / members
# ---------------------------------------------------------------------------

class MemberInviteIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=200)
    role: str = Field(pattern="^(owner|manager|cashier|kitchen|waiter|rider|accountant)$")


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    role: str
    is_active: bool
    created_at: datetime
    # joined from User
    email: str = ""
    full_name: str = ""
