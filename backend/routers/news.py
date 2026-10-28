import asyncio
import logging
from typing import List, Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

try:
    from backend.services.news_service import news_tracker, PROCESSED_NEWS_CACHE
except ImportError:
    from services.news_service import news_tracker, PROCESSED_NEWS_CACHE

router = APIRouter(
    prefix="/api/news",
    tags=["news"]
)

@router.get("/debug")
def debug_news():
    """Health & statistics endpoint for verifying Live News status."""
    return {
        "status": "online" if news_tracker.is_running else "idle",
        "is_running": news_tracker.is_running,
        "history_len": len(news_tracker.history),
        "cache_len": len(PROCESSED_NEWS_CACHE),
        "subscribers": len(news_tracker.subscribers)
    }

@router.get("/history")
def get_news_history():
    """HTTP fallback endpoint returning recent analyzed financial news."""
    return {
        "count": len(news_tracker.history),
        "news": news_tracker.get_recent_history()
    }

@router.websocket("/live")
async def websocket_news_endpoint(websocket: WebSocket):
    """Client WebSocket connection for live news broadcast."""
    await websocket.accept()
    queue = asyncio.Queue()
    news_tracker.subscribe(queue)

    # 1. Immediately send recent history so user doesn't see a blank widget
    try:
        for item in news_tracker.get_recent_history():
            await websocket.send_json(item)
    except Exception as e:
        logger.error(f"Error backfilling recent history to WebSocket client: {e}")
        news_tracker.unsubscribe(queue)
        return

    # 2. Stream live incoming items as they arrive
    try:
        while True:
            data = await queue.get()
            await websocket.send_json(data)
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected normally.")
        news_tracker.unsubscribe(queue)
    except Exception as e:
        logger.info(f"WebSocket client stream ended: {e}")
        news_tracker.unsubscribe(queue)
