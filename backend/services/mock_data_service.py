import math
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

try:
    from backend.models import StockSummary, StockDetail, PricePoint, MorningSignal, ForecastPoint
    from backend.forecast_engine import ForecastEngine
except ImportError:
    from models import StockSummary, StockDetail, PricePoint, MorningSignal, ForecastPoint
    from forecast_engine import ForecastEngine

class MockDataService:
    """
    Provides deterministic and synthetic fallback market data, mock OHLCV time series,
    and mock morning signals for offline operation, unit testing, and sandbox environments.
    """

    MOCK_STOCKS = [
        {"symbol": "TATASIL", "name": "Tata Silver ETF", "price": 21.31, "exchange": "NSE", "category": "ETF", "currency": "₹"},
        {"symbol": "TATSILV", "name": "Tata Silver ETF", "price": 21.31, "exchange": "NSE", "category": "ETF", "currency": "₹"},
        {"symbol": "TATASTEEL", "name": "Tata Steel Limited", "price": 164.50, "exchange": "NSE", "category": "EQUITY", "currency": "₹"},
        {"symbol": "RELIANCE", "name": "Reliance Industries Ltd", "price": 2980.50, "exchange": "NSE", "category": "EQUITY", "currency": "₹"},
        {"symbol": "HDFCBANK", "name": "HDFC Bank Limited", "price": 1640.25, "exchange": "NSE", "category": "EQUITY", "currency": "₹"},
        {"symbol": "ICICIBANK", "name": "ICICI Bank Ltd", "price": 1210.80, "exchange": "NSE", "category": "EQUITY", "currency": "₹"},
        {"symbol": "INFY", "name": "Infosys Limited", "price": 1780.00, "exchange": "NSE", "category": "EQUITY", "currency": "₹"},
        {"symbol": "TCS", "name": "Tata Consultancy Services Ltd", "price": 4250.00, "exchange": "NSE", "category": "EQUITY", "currency": "₹"},
        {"symbol": "SBIN", "name": "State Bank of India", "price": 820.60, "exchange": "NSE", "category": "EQUITY", "currency": "₹"},
        {"symbol": "GOLDBEES", "name": "Nippon India ETF Gold BeES", "price": 63.45, "exchange": "NSE", "category": "ETF", "currency": "₹"},
        {"symbol": "NIFTY50", "name": "NIFTY 50 Benchmark Index", "price": 25800.00, "exchange": "NSE", "category": "INDEX", "currency": "₹"}
    ]

    @classmethod
    def generate_synthetic_candles(cls, base_price: float, count: int = 30, interval_days: int = 1) -> List[PricePoint]:
        """Generates synthetic OHLCV candle sequence."""
        points: List[PricePoint] = []
        now = datetime.now()
        current = base_price

        for i in range(count, 0, -1):
            ts = now - timedelta(days=i * interval_days)
            drift = (random.random() - 0.48) * 0.02 * current
            open_p = round(current, 2)
            close_p = round(max(1.0, current + drift), 2)
            high_p = round(max(open_p, close_p) + (random.random() * 0.01 * current), 2)
            low_p = round(min(open_p, close_p) - (random.random() * 0.01 * current), 2)
            vol = random.randint(10000, 500000)

            points.append(PricePoint(
                timestamp=ts.isoformat(),
                time_label=ts.strftime("%b %d"),
                open=open_p,
                high=high_p,
                low=low_p,
                close=close_p,
                volume=vol
            ))
            current = close_p

        return points

    @classmethod
    def generate_fallback_stock_detail(cls, symbol: str) -> StockDetail:
        """Constructs a complete fallback StockDetail object for offline usage."""
        sym_upper = symbol.upper().strip()
        matched = next((s for s in cls.MOCK_STOCKS if s["symbol"] == sym_upper), None)
        
        base_p = matched["price"] if matched else 1000.0
        name = matched["name"] if matched else f"{sym_upper} Corporation"
        cat = matched["category"] if matched else "EQUITY"
        exch = matched["exchange"] if matched else "NSE"
        curr = matched["currency"] if matched else "₹"

        pts_1m = cls.generate_synthetic_candles(base_p, count=30, interval_days=1)
        pts_1d = cls.generate_synthetic_candles(base_p, count=20, interval_days=0)
        pts_1w = cls.generate_synthetic_candles(base_p, count=15, interval_days=1)
        pts_1y = cls.generate_synthetic_candles(base_p, count=52, interval_days=7)
        pts_5y = cls.generate_synthetic_candles(base_p, count=60, interval_days=30)

        hist_data = {
            "1D": pts_1d,
            "1W": pts_1w,
            "1M": pts_1m,
            "1Y": pts_1y,
            "5Y": pts_5y
        }

        closes = [p.close for p in pts_1m]
        curr_p = closes[-1]
        prev_p = closes[-2] if len(closes) > 1 else curr_p
        chg_amt = round(curr_p - prev_p, 2)
        chg_pct = round((chg_amt / prev_p * 100.0) if prev_p > 0 else 0.0, 2)

        f_points = ForecastEngine.generate_next_week_forecast(base_price=curr_p, historical_close_prices=closes)
        f_1d = ForecastEngine.generate_one_day_forecast(base_price=curr_p, historical_close_prices=closes)
        m_signal = ForecastEngine.generate_morning_signal(
            symbol=sym_upper,
            name=name,
            current_price=curr_p,
            history=pts_1m,
            custom_rationale="Synthetic simulation model generated for sandbox and fallback operation."
        )

        return StockDetail(
            symbol=sym_upper,
            name=name,
            category=cat,
            exchange=exch,
            current_price=curr_p,
            change_amount=chg_amt,
            change_pct=chg_pct,
            currency=curr,
            volume_24h="1.2M",
            market_cap="₹1.5T" if curr == "₹" else "$50B",
            description=f"Fallback simulated asset {sym_upper} traded on {exch}.",
            week_high_52=round(curr_p * 1.25, 2),
            week_low_52=round(curr_p * 0.85, 2),
            day_high=round(curr_p * 1.02, 2),
            day_low=round(curr_p * 0.98, 2),
            pe_ratio=22.4,
            historical_data=hist_data,
            forecast_next_week=f_points,
            forecast_1d=f_1d,
            morning_signal=m_signal,
            sparkline=closes[-15:],
            previous_close=prev_p,
            today_open=round(prev_p * 1.002, 2)
        )
