import asyncio
from .db import Session, AgentEvent, uid, now


class EventBus:
    def __init__(self):
        self.clients = set()

    async def emit(self, event_type, run_id=None, persist=True, **data):
        item = {
            "id": uid(),
            "run_id": run_id,
            "type": event_type,
            "timestamp": now(),
            **data,
        }
        if persist:
            with Session.begin() as db:
                db.add(AgentEvent(id=item["id"], run_id=run_id, payload=item))
        for q in tuple(self.clients):
            if q.full():
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            q.put_nowait(item)
        return item

    def subscribe(self):
        q = asyncio.Queue(maxsize=500)
        self.clients.add(q)
        return q


bus = EventBus()
