import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger("SymbolRegistryService")

class SymbolRegistryService:
    """
    Manages symbol identification, official ticker resolution,
    NSE India live symbol dynamic discovery, and database registry synchronization.
    """

    ALIASES = {
        "TATASIL": "TATSILV.NS",
        "TATSILV": "TATSILV.NS",
        "TATASILVER": "TATSILV.NS",
        "TATASTEEL": "TATASTEEL.NS",
        "NIFTY50": "^NSEI",
        "NIFTY": "^NSEI",
        "BANKNIFTY": "^NSEBANK",
        "SENSEX": "^BSESN"
    }

    # Core base seeds when database is initially initialized
    DEFAULT_SEED_SYMBOLS: List[Dict[str, str]] = [
        {"symbol": "TATASIL", "ticker": "TATSILV.NS", "name": "Tata Silver ETF", "category": "ETF", "exchange": "NSE", "currency": "₹"},
        {"symbol": "TATSILV", "ticker": "TATSILV.NS", "name": "Tata Silver ETF", "category": "ETF", "exchange": "NSE", "currency": "₹"},
        {"symbol": "TATASTEEL", "ticker": "TATASTEEL.NS", "name": "Tata Steel Limited", "category": "EQUITY", "exchange": "NSE", "currency": "₹"},
        {"symbol": "RELIANCE", "ticker": "RELIANCE.NS", "name": "Reliance Industries Ltd", "category": "EQUITY", "exchange": "NSE", "currency": "₹"},
        {"symbol": "HDFCBANK", "ticker": "HDFCBANK.NS", "name": "HDFC Bank Limited", "category": "EQUITY", "exchange": "NSE", "currency": "₹"},
        {"symbol": "ICICIBANK", "ticker": "ICICIBANK.NS", "name": "ICICI Bank Ltd", "category": "EQUITY", "exchange": "NSE", "currency": "₹"},
        {"symbol": "INFY", "ticker": "INFY.NS", "name": "Infosys Limited", "category": "EQUITY", "exchange": "NSE", "currency": "₹"},
        {"symbol": "TCS", "ticker": "TCS.NS", "name": "Tata Consultancy Services Ltd", "category": "EQUITY", "exchange": "NSE", "currency": "₹"},
        {"symbol": "SBIN", "ticker": "SBIN.NS", "name": "State Bank of India", "category": "EQUITY", "exchange": "NSE", "currency": "₹"},
        {"symbol": "ITC", "ticker": "ITC.NS", "name": "ITC Limited", "category": "EQUITY", "exchange": "NSE", "currency": "₹"},
        {"symbol": "GOLDBEES", "ticker": "GOLDBEES.NS", "name": "Nippon India ETF Gold BeES", "category": "ETF", "exchange": "NSE", "currency": "₹"},
        {"symbol": "SILVERBEES", "ticker": "SILVERBEES.NS", "name": "Nippon India ETF Silver BeES", "category": "ETF", "exchange": "NSE", "currency": "₹"},
        {"symbol": "NIFTYBEES", "ticker": "NIFTYBEES.NS", "name": "Nippon India ETF Nifty BeES", "category": "ETF", "exchange": "NSE", "currency": "₹"},
        {"symbol": "NIFTY 50", "ticker": "^NSEI", "name": "NIFTY 50 Index", "category": "INDEX", "exchange": "NSE", "currency": "₹"},
        {"symbol": "BANK NIFTY", "ticker": "^NSEBANK", "name": "NIFTY Bank Index", "category": "INDEX", "exchange": "NSE", "currency": "₹"},
        {"symbol": "SENSEX", "ticker": "^BSESN", "name": "BSE SENSEX", "category": "INDEX", "exchange": "BSE", "currency": "₹"},
    ]

    @classmethod
    def resolve_ticker(cls, symbol: str) -> str:
        s = symbol.upper().strip()
        if s in cls.ALIASES:
            return cls.ALIASES[s]
        if "." in s or "^" in s:
            return s
        
        db = None
        try:
            try:
                from backend.database import SessionLocal
                from backend.db_models import MarketSymbolDB
            except ImportError:
                from database import SessionLocal
                from db_models import MarketSymbolDB
            db = SessionLocal()
            row = db.query(MarketSymbolDB).filter(MarketSymbolDB.symbol == s).first()
            if row and row.ticker:
                return row.ticker
        except Exception:
            pass
        finally:
            if db is not None:
                db.close()
        return f"{s}.NS"

    @classmethod
    def fetch_symbol_metadata_from_api(
        cls,
        symbol: str,
        ticker: Optional[str] = None,
        exchange: Optional[str] = None,
        currency: Optional[str] = None,
        name: Optional[str] = None,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetches official asset metadata dynamically from live API (longName, quoteType, currency, exchange, summary).
        Auto-detects Indian (.NS) vs Global / US tickers without static hardcoding.
        """
        symbol_upper = symbol.upper().strip()
        yf_ticker = ticker or cls.resolve_ticker(symbol_upper)

        meta: Dict[str, Any] = {
            "symbol": symbol_upper,
            "ticker": yf_ticker,
            "name": name or symbol_upper,
            "category": category or ("ETF" if ("BEES" in symbol_upper or "SILV" in symbol_upper or "SILVER" in symbol_upper or "ETF" in symbol_upper or yf_ticker == "TATSILV.NS") else ("INDEX" if "^" in yf_ticker or "NIFTY" in symbol_upper else "EQUITY")),
            "exchange": exchange or ("BSE" if yf_ticker.endswith(".BO") or "^BSESN" in yf_ticker else ("NASDAQ" if "." not in yf_ticker and "^" not in yf_ticker else "NSE")),
            "currency": currency or ("$" if exchange in ["NASDAQ", "NYSE"] or (not yf_ticker.endswith(".NS") and not yf_ticker.endswith(".BO") and not yf_ticker.startswith("^NSE") and not yf_ticker.startswith("^BSE")) else "₹"),
            "description": f"Real-time asset {symbol_upper} traded on {exchange or 'NSE'}."
        }

        try:
            import yfinance as yf
            t_obj = yf.Ticker(yf_ticker)
            info = t_obj.info or {}
            
            if info:
                meta["name"] = info.get("longName") or info.get("shortName") or meta["name"]
                q_type = str(info.get("quoteType", "")).upper()
                if yf_ticker == "TATSILV.NS" or "SILV" in symbol_upper or "BEES" in symbol_upper or "ETF" in meta["name"].upper():
                    meta["category"] = "ETF"
                elif "ETF" in q_type:
                    meta["category"] = "ETF"
                elif "INDEX" in q_type:
                    meta["category"] = "INDEX"
                elif "EQUITY" in q_type:
                    meta["category"] = "EQUITY"

                meta["currency"] = "₹" if info.get("currency") in ["INR", None] else ("$" if info.get("currency") == "USD" else info.get("currency"))
                meta["exchange"] = info.get("exchange") or meta["exchange"]
                if info.get("longBusinessSummary"):
                    meta["description"] = info.get("longBusinessSummary")[:400] + "..."
        except Exception as e:
            logger.debug(f"Could not fetch extended info for {symbol_upper}: {e}")

        return meta

    @classmethod
    def fetch_nse_symbols_from_api(cls) -> List[Dict[str, Any]]:
        """
        Queries official NSE India API endpoints (NIFTY 50, NIFTY NEXT 50, ETFs)
        to dynamically discover active Indian symbols.
        """
        discovered_symbols: List[Dict[str, Any]] = []
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.nseindia.com/",
            "Connection": "keep-alive"
        }

        try:
            import requests
            session = requests.Session()
            session.headers.update(headers)

            try:
                session.get("https://www.nseindia.com", timeout=5)
            except Exception:
                pass

            api_endpoints = [
                ("https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050", "EQUITY"),
                ("https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20NEXT%2050", "EQUITY"),
                ("https://www.nseindia.com/api/etf", "ETF")
            ]

            seen_symbols = set()
            for endpoint_url, default_cat in api_endpoints:
                try:
                    res = session.get(endpoint_url, timeout=5)
                    if res.status_code == 200:
                        data = res.json()
                        items = data.get("data", [])
                        for item in items:
                            sym = item.get("symbol", "").strip()
                            if not sym or sym in ["NIFTY 50", "NIFTY NEXT 50", "NIFTY TOTAL MARKET"]:
                                continue

                            clean_sym = sym.replace(" ", "").upper()
                            if clean_sym in seen_symbols:
                                continue
                            seen_symbols.add(clean_sym)

                            cat = "ETF" if ("BEES" in clean_sym or default_cat == "ETF") else "EQUITY"
                            company_name = item.get("identifier", "").replace("EQN", "").replace("N", "") or clean_sym

                            discovered_symbols.append({
                                "symbol": clean_sym,
                                "ticker": f"{clean_sym}.NS",
                                "name": company_name,
                                "category": cat,
                                "exchange": "NSE",
                                "currency": "₹",
                                "description": f"Official NSE listed {cat.lower()} asset {clean_sym} traded on National Stock Exchange of India (NSE).",
                                "is_active": True
                            })
                except Exception as ex:
                    logger.warning(f"Error querying NSE India API ({endpoint_url}): {ex}")

        except Exception as e:
            logger.warning(f"Could not connect to NSE India live session: {e}")

        return discovered_symbols

    @classmethod
    def sync_symbols_to_db(cls, symbols: Optional[List[str]] = None) -> List[str]:
        """
        Fetches symbol metadata from NSE India API & Live Market APIs and persists into MarketSymbolDB.
        """
        try:
            from backend.database import SessionLocal
            from backend.db_models import MarketSymbolDB
        except ImportError:
            from database import SessionLocal
            from db_models import MarketSymbolDB

        saved_symbols = []
        db = SessionLocal()

        try:
            if not symbols:
                nse_items = cls.fetch_nse_symbols_from_api()
                for item in nse_items:
                    existing = db.query(MarketSymbolDB).filter(MarketSymbolDB.symbol == item["symbol"]).first()
                    if not existing:
                        new_item = MarketSymbolDB(
                            symbol=item["symbol"],
                            ticker=item["ticker"],
                            name=item["name"],
                            category=item["category"],
                            exchange=item["exchange"],
                            currency=item["currency"],
                            description=item["description"],
                            is_active=True,
                            created_at=datetime.utcnow(),
                            updated_at=datetime.utcnow()
                        )
                        db.add(new_item)
                    else:
                        existing.ticker = item["ticker"]
                        existing.name = item["name"]
                        existing.category = item["category"]
                        existing.exchange = item["exchange"]
                        existing.currency = item["currency"]
                        existing.updated_at = datetime.utcnow()
                    saved_symbols.append(item["symbol"])

                for seed in cls.DEFAULT_SEED_SYMBOLS:
                    existing = db.query(MarketSymbolDB).filter(MarketSymbolDB.symbol == seed["symbol"]).first()
                    if not existing:
                        new_item = MarketSymbolDB(
                            symbol=seed["symbol"],
                            ticker=seed["ticker"],
                            name=seed["name"],
                            category=seed["category"],
                            exchange=seed["exchange"],
                            currency=seed["currency"],
                            description=f"Core benchmark asset {seed['symbol']}.",
                            is_active=True,
                            created_at=datetime.utcnow(),
                            updated_at=datetime.utcnow()
                        )
                        db.add(new_item)
                        saved_symbols.append(seed["symbol"])
                    else:
                        existing.ticker = seed["ticker"]
                        existing.name = seed["name"]
                        existing.category = seed["category"]
                        existing.exchange = seed["exchange"]
                        existing.currency = seed["currency"]
                        existing.updated_at = datetime.utcnow()
                        saved_symbols.append(seed["symbol"])
            else:
                for sym in symbols:
                    sym_upper = sym.upper().strip()
                    meta = cls.fetch_symbol_metadata_from_api(sym_upper)
                    existing = db.query(MarketSymbolDB).filter(MarketSymbolDB.symbol == sym_upper).first()
                    if not existing:
                        new_item = MarketSymbolDB(
                            symbol=sym_upper,
                            ticker=meta["ticker"],
                            name=meta["name"],
                            category=meta["category"],
                            exchange=meta["exchange"],
                            currency=meta["currency"],
                            description=meta["description"],
                            is_active=True,
                            created_at=datetime.utcnow(),
                            updated_at=datetime.utcnow()
                        )
                        db.add(new_item)
                    else:
                        existing.ticker = meta["ticker"]
                        existing.name = meta["name"]
                        existing.category = meta["category"]
                        existing.exchange = meta["exchange"]
                        existing.currency = meta["currency"]
                        existing.description = meta["description"]
                        existing.updated_at = datetime.utcnow()
                    saved_symbols.append(sym_upper)

            db.commit()
            logger.info(f"Successfully synced {len(saved_symbols)} symbols to MarketSymbolDB.")
            return list(set(saved_symbols))
        except Exception as e:
            db.rollback()
            logger.error(f"Error syncing symbols to DB: {e}")
            return saved_symbols
        finally:
            db.close()

    @classmethod
    def get_monitored_symbols_from_db(cls) -> List[str]:
        """
        Retrieves active monitored symbols dynamically from the database.
        """
        try:
            from backend.database import SessionLocal
            from backend.db_models import MarketSymbolDB
        except ImportError:
            from database import SessionLocal
            from db_models import MarketSymbolDB

        db = SessionLocal()
        try:
            rows = db.query(MarketSymbolDB).filter(MarketSymbolDB.is_active == True).all()
            if not rows:
                cls.sync_symbols_to_db()
                rows = db.query(MarketSymbolDB).filter(MarketSymbolDB.is_active == True).all()
            return [r.symbol for r in rows]
        except Exception as e:
            logger.error(f"Error querying market symbols from DB: {e}")
            return [s["symbol"] for s in cls.DEFAULT_SEED_SYMBOLS]
        finally:
            db.close()
