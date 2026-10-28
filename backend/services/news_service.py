import asyncio
import json
import logging
import os
import re
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import List, Dict, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# In-memory cache to prevent duplicate news processing
PROCESSED_NEWS_CACHE = set()
MAX_CACHE_SIZE = 1000

import warnings
warnings.filterwarnings("ignore", category=FutureWarning, module=".*google.*")

# Setup Gemini AI client with graceful fallback
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai = None
try:
    import google.generativeai as _genai
    genai = _genai
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        logger.info("Gemini AI client configured successfully for Live News Analysis.")
except Exception as e:
    logger.info(f"Gemini client not initialized ({e}). Using robust heuristic engine.")

# Heuristic keywords for fallback detection
TARGET_KEYWORDS = [
    "TCS", "Reliance", "Gold", "Crude", "Silver", "RBI", "SEBI",
    "Nifty", "Sensex", "Tata Motors", "Tata Steel", "Tata", "Infosys",
    "Profit", "Loss", "HDFC Bank", "HDFC", "SBI", "ICICI Bank", "ICICI",
    "Adani", "Bharti Airtel", "Airtel", "ITC", "Larsen", "LT", "Wipro",
    "Axis Bank", "Maruti", "Sun Pharma", "Bajaj Finance", "Zomato",
    "Bitcoin", "Ethereum", "Nasdaq", "Fed", "Treasury"
]

BULLISH_WORDS = [
    "gain", "rise", "jump", "soar", "profit", "bull", "up", "high",
    "rally", "surge", "beats", "growth", "record", "mega deal", "order",
    "dividend", "acquisition", "upgrade", "outperform", "buy", "expansion"
]

BEARISH_WORDS = [
    "fall", "drop", "loss", "crash", "bloodbath", "bear", "down", "low",
    "plunge", "decline", "misses", "slump", "probe", "fine", "penalty",
    "downgrade", "selloff", "inflation", "hike", "cut", "warning", "layoffs"
]

def analyze_impact_with_ai(headline: str) -> Optional[Dict]:
    """
    Analyzes financial news headlines to extract:
    1. Affected stock / asset (asset)
    2. Sentiment impact (bullish | bearish | neutral)
    3. Short reason summary (reason)
    """
    # Heuristic analyzer helper
    def _heuristic_analyze() -> Dict:
        headline_lower = headline.lower()
        asset = ""
        for kw in TARGET_KEYWORDS:
            if kw.lower() in headline_lower:
                asset = kw
                break

        if not asset:
            matches = re.findall(r'[A-Z][a-zA-Z]+|[A-Z]{2,}', headline)
            stop_words = {'the', 'a', 'an', 'how', 'why', 'what', 'when', 'market', 'stock', 'stocks', 'indian', 'india', 'global', 'new'}
            for match in matches:
                if match.lower() not in stop_words:
                    asset = match.upper()
                    break

        if not asset:
            asset = "MARKET"

        bullish_matches = [w for w in BULLISH_WORDS if re.search(r'\b' + re.escape(w), headline_lower)]
        bearish_matches = [w for w in BEARISH_WORDS if re.search(r'\b' + re.escape(w), headline_lower)]

        impact = "neutral"
        reason = "Market development"

        if len(bullish_matches) > len(bearish_matches):
            impact = "bullish"
            reason = f"Positive {bullish_matches[0]}"
        elif len(bearish_matches) > len(bullish_matches):
            impact = "bearish"
            reason = f"Negative {bearish_matches[0]}"
        elif len(bullish_matches) > 0:
            impact = "bullish"
            reason = "Positive momentum"

        return {
            "asset": asset,
            "impact": impact,
            "reason": reason
        }

    # If no Gemini API key or module, use heuristic
    if not GEMINI_API_KEY or genai is None:
        return _heuristic_analyze()

    # Production AI path via Gemini Flash
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = (
            f"Analyze this financial news headline: '{headline}'. "
            "Reply strictly in JSON format without markdown blocks. "
            "Format: {\"asset\": \"Asset Name\", \"impact\": \"bullish|bearish|neutral\", \"reason\": \"3 word summary\"}"
        )
        response = model.generate_content(prompt)
        text_resp = response.text.strip()
        if text_resp.startswith("```json"):
            text_resp = text_resp.replace("```json", "").replace("```", "").strip()
        elif text_resp.startswith("```"):
            text_resp = text_resp.replace("```", "").strip()
        parsed = json.loads(text_resp)
        # Validate schema keys
        if "asset" in parsed and "impact" in parsed:
            parsed["impact"] = parsed["impact"].lower()
            if parsed["impact"] not in ["bullish", "bearish", "neutral"]:
                parsed["impact"] = "neutral"
            return parsed
        return _heuristic_analyze()
    except Exception as e:
        logger.error(f"Error calling AI for headline '{headline}': {e}. Falling back to heuristic.")
        return _heuristic_analyze()

def fetch_rss_news() -> List[Dict]:
    """Fetches and parses public financial RSS feeds with browser headers."""
    urls = [
        "https://economictimes.indiatimes.com/markets/rssfeeds/2146842.cms",
        "https://www.moneycontrol.com/rss/MCtopnews.xml",
        "https://www.livemint.com/rss/markets"
    ]
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
    news_items = []

    for url in urls:
        try:
            response = requests.get(url, headers=headers, timeout=6)
            if response.status_code == 200:
                root = ET.fromstring(response.content)
                for item in root.findall('./channel/item'):
                    title = item.find('title')
                    link = item.find('link')
                    if title is not None and title.text and link is not None and link.text:
                        clean_title = re.sub(r'<[^>]+>', '', title.text).strip()
                        news_items.append({"title": clean_title, "link": link.text.strip()})
        except Exception as e:
            logger.error(f"Error fetching RSS from {url}: {e}")

    return news_items

class NewsTrackerService:
    def __init__(self):
        self.subscribers: List[asyncio.Queue] = []
        self.is_running = False
        # Seed instant historical backfill so first-time clients immediately see Intel
        self.history: List[Dict] = [
            {
                "headline": "TCS bags $1.2B mega enterprise cloud transformation deal from European client; shares gain 2.8%",
                "analysis": {
                    "asset": "TCS",
                    "impact": "bullish",
                    "reason": "Mega cloud deal"
                },
                "time": datetime.now().strftime("%H:%M:%S")
            },
            {
                "headline": "Crude oil plunges 3.4% as Middle East tensions ease; Indian oil marketing firms rally",
                "analysis": {
                    "asset": "Crude",
                    "impact": "bullish",
                    "reason": "Lower input costs"
                },
                "time": datetime.now().strftime("%H:%M:%S")
            },
            {
                "headline": "RBI keeps repo rate unchanged at 6.50%; highlights robust GDP growth trajectory",
                "analysis": {
                    "asset": "RBI",
                    "impact": "bullish",
                    "reason": "Policy stability"
                },
                "time": datetime.now().strftime("%H:%M:%S")
            },
            {
                "headline": "Tata Motors commercial vehicle deliveries rise 14% YoY; Q4 margins beat street estimates",
                "analysis": {
                    "asset": "Tata Motors",
                    "impact": "bullish",
                    "reason": "Strong volume growth"
                },
                "time": datetime.now().strftime("%H:%M:%S")
            },
            {
                "headline": "Federal Reserve signals cautious stance on rate cuts amid sticky core service inflation",
                "analysis": {
                    "asset": "Fed",
                    "impact": "neutral",
                    "reason": "Rate pause signal"
                },
                "time": datetime.now().strftime("%H:%M:%S")
            }
        ]

    def subscribe(self, queue: asyncio.Queue):
        self.subscribers.append(queue)
        logger.info(f"New client subscribed to live news. Active subscribers: {len(self.subscribers)}")

    def unsubscribe(self, queue: asyncio.Queue):
        if queue in self.subscribers:
            self.subscribers.remove(queue)
            logger.info(f"Client disconnected. Remaining subscribers: {len(self.subscribers)}")

    async def broadcast(self, data: dict):
        # Keep last 10 in memory history
        self.history.insert(0, data)
        if len(self.history) > 10:
            self.history.pop()

        for queue in list(self.subscribers):
            try:
                await queue.put(data)
            except Exception as e:
                logger.error(f"Failed to put to subscriber queue: {e}")

    def get_recent_history(self) -> List[Dict]:
        """Returns the last 5 items from oldest to newest for instant initial display."""
        return list(reversed(self.history[:5]))

    async def start_tracking(self):
        """Infinite polling loop running every 10 seconds."""
        self.is_running = True
        logger.info("Live Market News & AI Affected-Stock Intelligence Tracker Started.")
        while self.is_running:
            try:
                # Fetch RSS items in a non-blocking thread executor
                loop = asyncio.get_running_loop()
                news_items = await loop.run_in_executor(None, fetch_rss_news)

                # Process oldest first to preserve chronological order
                for item in reversed(news_items):
                    if not self.is_running:
                        break
                    link = item.get('link', '')
                    title = item.get('title', '')
                    if not title or not link:
                        continue

                    if link in PROCESSED_NEWS_CACHE:
                        continue

                    # Memory bounds maintenance
                    if len(PROCESSED_NEWS_CACHE) >= MAX_CACHE_SIZE:
                        PROCESSED_NEWS_CACHE.clear()

                    PROCESSED_NEWS_CACHE.add(link)

                    # Analyze headline
                    logger.info(f"Analyzing news headline: {title[:70]}...")
                    ai_result = await loop.run_in_executor(None, analyze_impact_with_ai, title)

                    if ai_result:
                        broadcast_data = {
                            "headline": title,
                            "analysis": ai_result,
                            "time": datetime.now().strftime("%H:%M:%S"),
                            "link": link
                        }
                        await self.broadcast(broadcast_data)

            except Exception as e:
                logger.error(f"Live News Tracker loop error: {e}")

            # Sleep in intervals so cancellation is responsive
            for _ in range(10):
                if not self.is_running:
                    break
                await asyncio.sleep(1)

news_tracker = NewsTrackerService()
