import math
import random
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

try:
    from backend.agents.base_agent import BaseAgent, AgentResult
except ImportError:
    from agents.base_agent import BaseAgent, AgentResult

class MarketDataAgent(BaseAgent):
    """
    Market Data Agent:
    Fetches, cleans, and normalizes historical OHLCV time-series and fundamentals
    from yfinance and internal market cache for TimesFM 3.0 input.
    """
    def __init__(self):
        super().__init__(name="Market Data Agent")

    def _resolve_yfinance_ticker(self, symbol: str) -> str:
        s = symbol.upper().strip()
        mapping = {
            "TATASIL": "TATSILV.NS",
            "TATSILV": "TATSILV.NS",
            "TATASILVER": "TATSILV.NS",
            "TATASTEEL": "TATASTEEL.NS",
            "RELIANCE": "RELIANCE.NS",
            "NIFTY50": "^NSEI",
            "NIFTY": "^NSEI",
            "TCS": "TCS.NS",
            "INFY": "INFY.NS",
            "HDFCBANK": "HDFCBANK.NS",
            "GOLDBEES": "GOLDBEES.NS",
            "SBIN": "SBIN.NS",
            "ICICIBANK": "ICICIBANK.NS",
            "AAPL": "AAPL",
            "NVDA": "NVDA",
            "MSFT": "MSFT",
            "TSLA": "TSLA"
        }
        return mapping.get(s, s if "." in s or "^" in s else f"{s}.NS")

    def run(self, state: Dict[str, Any]) -> AgentResult:
        symbol = state.get("symbol", "TATASIL").upper()
        
        # 1. Check internal detail cache
        stock_detail = None
        try:
            try:
                from backend.data_store import db
            except ImportError:
                from data_store import db
            stock_detail = db.get_stock_detail(symbol)
        except Exception:
            pass
        history_points = []
        current_price = 100.0
        company_name = symbol
        currency = "₹"
        exchange = "NSE"
        
        if stock_detail:
            current_price = stock_detail.current_price
            company_name = stock_detail.name
            currency = stock_detail.currency
            exchange = stock_detail.exchange
            month_pts = stock_detail.historical_data.get("1M", [])
            history_points = [p.close for p in month_pts] if month_pts else []

        # 2. Fetch live data via yfinance with strict 3-second timeout
        yf_ticker = self._resolve_yfinance_ticker(symbol)
        yf_closes: List[float] = []
        yf_volumes: List[int] = []
        fundamentals: Dict[str, Any] = {}

        def _fetch_yf():
            try:
                import yfinance as yf
                ticker_obj = yf.Ticker(yf_ticker)
                df = ticker_obj.history(period="3mo", interval="1d", timeout=3.0)
                return ticker_obj, df
            except Exception:
                return None, None

        try:
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_fetch_yf)
                ticker_obj, df = future.result(timeout=3.5)

            if df is not None and not df.empty and len(df) >= 10:
                yf_closes = [round(float(c), 2) for c in df["Close"].dropna().tolist()]
                yf_volumes = [int(v) for v in df["Volume"].dropna().tolist()]
                latest_close = yf_closes[-1]
                if latest_close > 0:
                    current_price = latest_close
                try:
                    info = ticker_obj.fast_info
                    fundamentals = {
                        "market_cap": getattr(info, "market_cap", None),
                        "year_high": getattr(info, "year_high", None),
                        "year_low": getattr(info, "year_low", None),
                        "currency": getattr(info, "currency", currency)
                    }
                except Exception:
                    pass
        except Exception as e:
            print(f"[{self.name}] yfinance fetch note for {yf_ticker}: {e}")

        # Choose the richest closes series
        final_closes = yf_closes if len(yf_closes) >= 15 else (history_points if history_points else [current_price])
        
        # Calculate Technical Indicators
        rsi = self._calculate_rsi(final_closes)
        sma20 = round(float(np.mean(final_closes[-20:])), 2) if len(final_closes) >= 20 else current_price
        sma50 = round(float(np.mean(final_closes[-50:])), 2) if len(final_closes) >= 50 else current_price
        volatility_pct = round(float(np.std(final_closes[-20:]) / np.mean(final_closes[-20:]) * 100), 2) if len(final_closes) >= 5 else 1.8

        summary = (
            f"Collected {len(final_closes)} OHLCV points for {symbol} ({company_name}) on {exchange}. "
            f"Current: {currency}{current_price:.2f}, RSI(14): {rsi:.1f}, 20-day SMA: {currency}{sma20:.2f}, Volatility: {volatility_pct}%."
        )

        return AgentResult(
            agent_name=self.name,
            status="SUCCESS",
            summary=summary,
            data={
                "symbol": symbol,
                "yf_ticker": yf_ticker,
                "company_name": company_name,
                "exchange": exchange,
                "currency": currency,
                "current_price": current_price,
                "historical_closes": final_closes,
                "volumes": yf_volumes[-30:] if yf_volumes else [],
                "technical_indicators": {
                    "rsi": rsi,
                    "sma_20": sma20,
                    "sma_50": sma50,
                    "volatility_pct": volatility_pct
                },
                "fundamentals": fundamentals
            }
        )

    def _calculate_rsi(self, prices: List[float], period: int = 14) -> float:
        if len(prices) < period + 1:
            return 50.0
        deltas = np.diff(prices)
        seed = deltas[:period]
        up = seed[seed >= 0].sum() / period if len(seed[seed >= 0]) > 0 else 0
        down = -seed[seed < 0].sum() / period if len(seed[seed < 0]) > 0 else 0
        
        for d in deltas[period:]:
            up = (up * (period - 1) + (d if d > 0 else 0)) / period
            down = (down * (period - 1) + (-d if d < 0 else 0)) / period

        if down == 0:
            return 100.0
        rs = up / down
        return round(100.0 - (100.0 / (1.0 + rs)), 1)
