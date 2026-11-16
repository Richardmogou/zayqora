import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    full_name: str
    is_platform_admin: bool


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
    country: str
    currency: str
    timezone: str
