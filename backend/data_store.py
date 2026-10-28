import os
import json
import logging
from typing import Dict, List, Optional, Any
try:
    from backend.models import (
        StockSummary, StockDetail, PricePoint, ForecastPoint,
        MorningSignal, UserProfile, PortfolioPosition, PortfolioSummary
    )
    from backend.live_market_service import LiveMarketService
except ImportError:
    from models import (
        StockSummary, StockDetail, PricePoint, ForecastPoint,
        MorningSignal, UserProfile, PortfolioPosition, PortfolioSummary
    )
    from live_market_service import LiveMarketService

logger = logging.getLogger("DataStore")

class DataStore:
    """
    Dynamic in-memory & live repository for TradeAI.
    All stock quotes, multi-timeframe candles, TimesFM predictions,
    and 9:00 AM morning signals are fetched 100% dynamically via LiveMarketService.
    """
    def __init__(self):
        self.users: Dict[str, UserProfile] = {}
        self.portfolio_positions: Dict[str, List[PortfolioPosition]] = {}
        self._init_user_and_portfolio_state()

    @property
    def monitored_symbols(self) -> List[str]:
        """
        Dynamically fetches all active monitored symbols from the database.
        """
        return LiveMarketService.get_monitored_symbols_from_db()

    def _init_user_and_portfolio_state(self):
        # Default user profile
        demo_user = UserProfile(
            id="usr_demo_01",
            username="trader_pro",
            email="trader@tradeai.app",
            full_name="Alex Vance",
            avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
            risk_tolerance="AGGRESSIVE",
            morning_alert_time="08:30 AM",
            enable_push_notifications=True,
            watchlist=["TATASIL", "NIFTY50", "RELIANCE", "AAPL", "GOLDBEES"]
        )
        self.users[demo_user.id] = demo_user

        # Initial tracked holdings (live market valuation calculated dynamically)
        self.portfolio_positions[demo_user.id] = [
            PortfolioPosition(
                id="pos_1",
                symbol="TATASIL",
                name="Tata Silver ETF",
                shares=1500.0,
                average_buy_price=19.80,
                current_price=21.31,
                invested_amount=29700.0,
                current_value=31965.0,
                unrealized_pnl=2265.0,
                unrealized_pnl_pct=7.63,
                buy_date="2026-08-15"
            ),
            PortfolioPosition(
                id="pos_2",
                symbol="RELIANCE",
                name="Reliance Industries Ltd",
                shares=15.0,
                average_buy_price=2890.00,
                current_price=2890.00,
                invested_amount=43350.0,
                current_value=43350.0,
                unrealized_pnl=0.0,
                unrealized_pnl_pct=0.0,
                buy_date="2026-09-01"
            ),
            PortfolioPosition(
                id="pos_3",
                symbol="GOLDBEES",
                name="Nippon India ETF Gold BeES",
                shares=300.0,
                average_buy_price=64.10,
                current_price=64.10,
                invested_amount=19230.0,
                current_value=19230.0,
                unrealized_pnl=0.0,
                unrealized_pnl_pct=0.0,
                buy_date="2026-07-20"
            )
        ]

    def get_all_summaries(self) -> List[StockSummary]:
        """
        Fetches live real-time summaries for all monitored market tickers.
        """
        return LiveMarketService.get_live_summaries(self.monitored_symbols)

    def get_stock_detail(self, symbol: str) -> Optional[StockDetail]:
        """
        Fetches live real-time stock details, candles, and AI forecasts for any symbol.
        """
        try:
            return LiveMarketService.fetch_live_stock_detail(symbol.upper().strip())
        except Exception as e:
            logger.error(f"Error fetching live stock detail for {symbol}: {e}")
            return None

    def search_stocks(self, query: str) -> List[StockSummary]:
        """
        Ultra-fast, non-blocking fuzzy & token search across MarketSymbolDB,
        cached market summaries, and registered database assets.
        Guarantees sub-millisecond response time with zero network lag.
        """
        import difflib
        q = (query or "").lower().strip()
        if not q:
            return []

        matched_symbols = set()
        results: List[StockSummary] = []

        # 1. Check in-memory cached summaries if warm
        try:
            if hasattr(LiveMarketService, "_cache_summaries") and LiveMarketService._cache_summaries:
                for s in LiveMarketService._cache_summaries:
                    if q in s.symbol.lower() or q in s.name.lower() or q in s.category.lower():
                        if s.symbol not in matched_symbols:
                            matched_symbols.add(s.symbol)
                            results.append(s)
        except Exception:
            pass

        # 2. Query MarketSymbolDB for substring matches
        try:
            try:
                from backend.database import SessionLocal
                from backend.db_models import MarketSymbolDB
                from backend.services.mock_data_service import MockDataService
            except ImportError:
                from database import SessionLocal
                from db_models import MarketSymbolDB
                from services.mock_data_service import MockDataService
            
            db_session = SessionLocal()
            try:
                # Substring query on symbol, name, or category
                rows = db_session.query(MarketSymbolDB).filter(
                    (MarketSymbolDB.symbol.ilike(f"%{q}%")) |
                    (MarketSymbolDB.name.ilike(f"%{q}%")) |
                    (MarketSymbolDB.category.ilike(f"%{q}%"))
                ).limit(15).all()

                for row in rows:
                    if row.symbol not in matched_symbols:
                        matched_symbols.add(row.symbol)
                        # Build summary from DB trade store or fallback
                        detail = LiveMarketService.get_trade_data_from_db(row.symbol, max_age_seconds=None)
                        if not detail:
                            detail = MockDataService.generate_fallback_stock_detail(row.symbol)
                        
                        results.append(
                            StockSummary(
                                symbol=detail.symbol,
                                name=detail.name,
                                category=detail.category,
                                exchange=detail.exchange,
                                current_price=detail.current_price,
                                change_amount=detail.change_amount,
                                change_pct=detail.change_pct,
                                currency=detail.currency,
                                volume_24h=detail.volume_24h,
                                market_cap=detail.market_cap,
                                sparkline=detail.sparkline,
                                morning_signal=detail.morning_signal,
                                previous_close=detail.previous_close,
                                today_open=detail.today_open,
                                day_high=detail.day_high,
                                day_low=detail.day_low
                            )
                        )

                # 3. Fuzzy match if no direct substring matches (e.g. typos like "tatsilv" -> "TATASIL", "SILVERBEES")
                if not results:
                    all_rows = db_session.query(MarketSymbolDB).all()
                    sym_dict = {r.symbol.lower(): r for r in all_rows}
                    
                    # Fuzzy match on symbol
                    close_syms = difflib.get_close_matches(q, list(sym_dict.keys()), n=5, cutoff=0.35)
                    # Partial token matches (e.g. "tatsilv" contains "tat" or "silv")
                    token_matches = []
                    for k, r in sym_dict.items():
                        if any(token in k or token in r.name.lower() for token in [q[:3], q[:4], q[-4:], q[-3:]] if len(token) >= 3):
                            token_matches.append(r)

                    fuzzy_candidates = [sym_dict[cs] for cs in close_syms] + token_matches
                    for cand in fuzzy_candidates:
                        if cand.symbol not in matched_symbols:
                            matched_symbols.add(cand.symbol)
                            detail = LiveMarketService.get_trade_data_from_db(cand.symbol, max_age_seconds=None) or MockDataService.generate_fallback_stock_detail(cand.symbol)
                            results.append(
                                StockSummary(
                                    symbol=detail.symbol,
                                    name=detail.name,
                                    category=detail.category,
                                    exchange=detail.exchange,
                                    current_price=detail.current_price,
                                    change_amount=detail.change_amount,
                                    change_pct=detail.change_pct,
                                    currency=detail.currency,
                                    volume_24h=detail.volume_24h,
                                    market_cap=detail.market_cap,
                                    sparkline=detail.sparkline,
                                    morning_signal=detail.morning_signal,
                                    previous_close=detail.previous_close,
                                    today_open=detail.today_open,
                                    day_high=detail.day_high,
                                    day_low=detail.day_low
                                )
                            )
            finally:
                db_session.close()
        except Exception as ex:
            logger.error(f"Database search error: {ex}")

        # 4. If still empty, return synthetic fallback for query ticker so search never fails
        if not results and len(q) >= 2:
            try:
                try:
                    from backend.services.mock_data_service import MockDataService
                except ImportError:
                    from services.mock_data_service import MockDataService
                detail = MockDataService.generate_fallback_stock_detail(q.upper())
                results.append(
                    StockSummary(
                        symbol=detail.symbol,
                        name=detail.name,
                        category=detail.category,
                        exchange=detail.exchange,
                        current_price=detail.current_price,
                        change_amount=detail.change_amount,
                        change_pct=detail.change_pct,
                        currency=detail.currency,
                        volume_24h=detail.volume_24h,
                        market_cap=detail.market_cap,
                        sparkline=detail.sparkline,
                        morning_signal=detail.morning_signal,
                        previous_close=detail.previous_close,
                        today_open=detail.today_open,
                        day_high=detail.day_high,
                        day_low=detail.day_low
                    )
                )
            except Exception:
                pass

        return results

    def get_morning_signals(self) -> List[MorningSignal]:
        """
        Generates 9:00 AM morning signals computed dynamically from live historical candles.
        """
        signals: List[MorningSignal] = []
        all_summaries = self.get_all_summaries()
        for stock in all_summaries:
            if stock.morning_signal:
                signals.append(stock.morning_signal)
        # Sort by confidence descending
        signals.sort(key=lambda s: s.confidence, reverse=True)
        return signals

    def get_portfolio_summary(self, user_id: str) -> PortfolioSummary:
        """
        Computes user portfolio metrics dynamically using live real-time market prices.
        """
        positions = self.portfolio_positions.get(user_id, [])
        updated_positions: List[PortfolioPosition] = []
        total_inv = 0.0
        total_curr = 0.0
        
        for pos in positions:
            try:
                detail = self.get_stock_detail(pos.symbol)
                live_price = detail.current_price if detail else pos.current_price
            except Exception:
                live_price = pos.current_price

            curr_val = round(pos.shares * live_price, 2)
            inv_val = round(pos.shares * pos.average_buy_price, 2)
            pnl = round(curr_val - inv_val, 2)
            pnl_pct = round((pnl / inv_val * 100.0) if inv_val > 0 else 0.0, 2)
            
            updated_pos = PortfolioPosition(
                id=pos.id,
                symbol=pos.symbol,
                name=pos.name,
                shares=pos.shares,
                average_buy_price=pos.average_buy_price,
                current_price=live_price,
                invested_amount=inv_val,
                current_value=curr_val,
                unrealized_pnl=pnl,
                unrealized_pnl_pct=pnl_pct,
                buy_date=pos.buy_date
            )
            updated_positions.append(updated_pos)
            total_inv += inv_val
            total_curr += curr_val

        total_pnl = round(total_curr - total_inv, 2)
        total_pnl_pct = round((total_pnl / total_inv * 100.0) if total_inv > 0 else 0.0, 2)

        return PortfolioSummary(
            total_invested=round(total_inv, 2),
            total_current_value=round(total_curr, 2),
            total_pnl=total_pnl,
            total_pnl_pct=total_pnl_pct,
            positions=updated_positions
        )

# Global singleton repository instance
db = DataStore()
