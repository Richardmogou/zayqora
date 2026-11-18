import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    restaurant_id: uuid.UUID
    event_type: str
    title: str
    body: str
    entity_type: str | None
    entity_id: str | None
    data: dict | None
    read_at: datetime | None
    created_at: datetime
