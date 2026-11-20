import asyncio
from collections import defaultdict
from datetime import datetime, timezone
import json
from typing import Any

from fastapi import WebSocket


class RealtimeHub:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, restaurant_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._loop = asyncio.get_running_loop()
        self._connections[restaurant_id].add(websocket)

    def disconnect(self, restaurant_id: str, websocket: WebSocket) -> None:
        bucket = self._connections.get(restaurant_id)
        if not bucket:
            return
        bucket.discard(websocket)
        if not bucket:
            self._connections.pop(restaurant_id, None)

    async def broadcast(self, restaurant_id: str, event_type: str, data: dict[str, Any] | None = None) -> None:
        sockets = list(self._connections.get(restaurant_id, ()))
        if not sockets:
            return
        message = json.dumps({
            "event": event_type,
            "restaurant_id": restaurant_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data or {},
        })
        stale: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_text(message)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(restaurant_id, ws)

    def publish(self, restaurant_id: str, event_type: str, data: dict[str, Any] | None = None) -> None:
        if restaurant_id not in self._connections or not self._loop or self._loop.is_closed():
            return
        try:
            running = asyncio.get_running_loop()
            if running is self._loop:
                running.create_task(self.broadcast(restaurant_id, event_type, data))
                return
        except RuntimeError:
            pass
        asyncio.run_coroutine_threadsafe(self.broadcast(restaurant_id, event_type, data), self._loop)


hub = RealtimeHub()
