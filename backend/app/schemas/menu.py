import uuid
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Modifier
# ---------------------------------------------------------------------------

class ModifierIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    price_delta_minor: int = 0
    is_default: bool = False
    position: int = 0


class ModifierGroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    required: bool = False
    multi_select: bool = False
    position: int = 0
    modifiers: list[ModifierIn] = []


class ModifierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    price_delta_minor: int
    is_default: bool
    position: int


class ModifierGroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    required: bool
    multi_select: bool
    position: int
    modifiers: list[ModifierOut] = []


# ---------------------------------------------------------------------------
# Category
# ---------------------------------------------------------------------------

class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    position: int
    is_active: bool


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    position: int = 0
    is_active: bool = True


class CategoryUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    position: int | None = None
    is_active: bool | None = None


class ImageUploadIn(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    content_type: str = Field(min_length=3, max_length=50)
    data_base64: str = Field(min_length=4)


class ImageUploadOut(BaseModel):
    image_url: str


# ---------------------------------------------------------------------------
# Item
# ---------------------------------------------------------------------------

class MenuItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    category_id: uuid.UUID
    name: str
    description: str | None
    image_url: str | None = None
    price_minor: int
    discounted_price_minor: int | None = None
    tax_rate: str
    prep_time_minutes: int | None
    kitchen_station: str | None = None
    allergens: str | None
    dietary_tags: str | None = None
    is_featured: bool = False
    is_available: bool
    is_published: bool
    position: int
    modifier_groups: list[ModifierGroupOut] = []


class MenuItemIn(BaseModel):
    category_id: uuid.UUID
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    image_url: str | None = None
    price_minor: int = Field(ge=0)
    discounted_price_minor: int | None = Field(default=None, ge=0)
    tax_rate: str = "0"
    prep_time_minutes: int | None = Field(default=None, ge=1, le=300)
    kitchen_station: str | None = Field(default=None, max_length=100)
    allergens: str | None = None
    dietary_tags: str | None = Field(default=None, max_length=200)
    is_featured: bool = False
    is_available: bool = True
    is_published: bool = False
    position: int = 0
    modifier_groups: list[ModifierGroupIn] | None = None


class MenuItemUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    image_url: str | None = None
    price_minor: int | None = Field(default=None, ge=0)
    discounted_price_minor: int | None = Field(default=None, ge=0)
    tax_rate: str | None = None
    prep_time_minutes: int | None = Field(default=None, ge=1, le=300)
    kitchen_station: str | None = Field(default=None, max_length=100)
    allergens: str | None = None
    dietary_tags: str | None = Field(default=None, max_length=200)
    is_featured: bool | None = None
    is_available: bool | None = None
    is_published: bool | None = None
    position: int | None = None
    category_id: uuid.UUID | None = None
    modifier_groups: list[ModifierGroupIn] | None = None


class AvailabilityIn(BaseModel):
    is_available: bool


# ---------------------------------------------------------------------------
# Public menu (storefront)
# ---------------------------------------------------------------------------

class PublicModifierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    price_delta_minor: int
    is_default: bool


class PublicModifierGroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    required: bool
    multi_select: bool
    modifiers: list[PublicModifierOut] = []


class PublicMenuItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    description: str | None
    image_url: str | None = None
    price_minor: int
    discounted_price_minor: int | None = None
    prep_time_minutes: int | None = None
    allergens: str | None
    dietary_tags: str | None = None
    is_featured: bool = False
    is_available: bool
    modifier_groups: list[PublicModifierGroupOut] = []


class PublicCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    position: int
    items: list[PublicMenuItemOut] = []
