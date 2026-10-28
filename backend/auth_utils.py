import os
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

try:
    from backend.database import get_db, Base, engine, SessionLocal
    from backend.db_models import UserDB, AuditLogDB, MarketSymbolDB, PredictionDB, TradeDataDB, WishlistDB, PineScriptDB
except ImportError:
    from database import get_db, Base, engine, SessionLocal
    from db_models import UserDB, AuditLogDB, MarketSymbolDB, PredictionDB, TradeDataDB, WishlistDB, PineScriptDB

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "tradeai_ultra_secure_jwt_secret_key_2026_timesfm")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # 24 Hours

security = HTTPBearer(auto_error=True)
security_optional = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    """Hashes a password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Encodes a JWT access token with payload and expiration."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

def get_current_user(
    auth: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> UserDB:
    """
    FastAPI dependency that extracts Bearer token, validates JWT, 
    and returns the active UserDB record.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = auth.credentials
    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    if not user_id:
        raise credentials_exception
    
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated or suspended. Please contact admin."
        )
    
    return user

def get_optional_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
    db: Session = Depends(get_db)
) -> Optional[UserDB]:
    """
    FastAPI dependency that returns the authenticated UserDB if a valid Bearer token is provided,
    or None if the request is unauthenticated, allowing public read endpoints to work seamlessly.
    """
    if not auth or not auth.credentials:
        return None
    try:
        payload = decode_access_token(auth.credentials)
        if not payload:
            return None
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = db.query(UserDB).filter(UserDB.id == user_id).first()
        return user if (user and user.is_active) else None
    except Exception:
        return None

def get_current_admin_user(
    current_user: UserDB = Depends(get_current_user)
) -> UserDB:
    """
    FastAPI dependency that verifies the authenticated user has 'admin' role.
    """
    if current_user.role.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privilege required. Access denied."
        )
    return current_user

def log_audit_event(
    db: Session,
    action: str,
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None
):
    """Utility to record an audit log event into the database."""
    try:
        log = AuditLogDB(
            user_id=user_id,
            username=username,
            action=action,
            details=details,
            ip_address=ip_address,
            created_at=datetime.utcnow()
        )
        db.add(log)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Audit Log Error]: {e}")

def init_db_and_seed():
    """Initializes tables and seeds default Admin and Trader accounts."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Check if admin exists
        admin_user = db.query(UserDB).filter(UserDB.email == "admin@tradeai.app").first()
        if not admin_user:
            admin_user = UserDB(
                id="usr_admin_01",
                username="admin_super",
                email="admin@tradeai.app",
                password_hash=hash_password("AdminPassword@123"),
                full_name="Chief Market Admin",
                role="admin",
                is_active=True,
                avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
                risk_tolerance="AGGRESSIVE",
                morning_alert_time="08:30 AM",
                enable_push_notifications=True,
                watchlist_json='["TATASIL", "NIFTY50", "RELIANCE", "AAPL", "GOLDBEES"]',
                portfolio_balance=250000.0,
                created_at=datetime.utcnow()
            )
            db.add(admin_user)
            print("[Database Seed] Created default Admin: admin@tradeai.app / AdminPassword@123")

        # Check if demo trader exists
        trader_user = db.query(UserDB).filter(UserDB.email == "trader@tradeai.app").first()
        if not trader_user:
            trader_user = UserDB(
                id="usr_demo_01",
                username="trader_pro",
                email="trader@tradeai.app",
                password_hash=hash_password("TraderPassword@123"),
                full_name="Alex Vance",
                role="user",
                is_active=True,
                avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
                risk_tolerance="MODERATE",
                morning_alert_time="08:30 AM",
                enable_push_notifications=True,
                watchlist_json='["TATASIL", "NIFTY50", "RELIANCE"]',
                portfolio_balance=100000.0,
                created_at=datetime.utcnow()
            )
            db.add(trader_user)
            print("[Database Seed] Created default Trader: trader@tradeai.app / TraderPassword@123")

        # Check and seed/sync Market Symbols from API
        try:
            from backend.db_models import MarketSymbolDB, TradeDataDB, PredictionDB
            from backend.live_market_service import LiveMarketService
        except ImportError:
            from db_models import MarketSymbolDB, TradeDataDB, PredictionDB
            from live_market_service import LiveMarketService
            
        sym_count = db.query(MarketSymbolDB).count()
        if sym_count == 0:
            print("[Database Seed] Syncing market symbols from API into database...")
            LiveMarketService.sync_symbols_to_db()
        else:
            # Self-healing migration: Ensure TATASIL correctly maps to Tata Silver ETF (TATSILV.NS)
            tatasil_row = db.query(MarketSymbolDB).filter(MarketSymbolDB.symbol == "TATASIL").first()
            if tatasil_row and (tatasil_row.ticker != "TATSILV.NS" or "Steel" in tatasil_row.name):
                print("[Database Migration] Correcting TATASIL to Tata Silver ETF (TATSILV.NS)...")
                tatasil_row.ticker = "TATSILV.NS"
                tatasil_row.name = "Tata Silver ETF"
                tatasil_row.category = "ETF"
                tatasil_row.updated_at = datetime.utcnow()
                # Purge stale high-price caches for TATASIL (> 50) from previous Tata Steel mapping
                try:
                    db.query(TradeDataDB).filter(TradeDataDB.symbol == "TATASIL").delete()
                    db.query(PredictionDB).filter(PredictionDB.symbol == "TATASIL").delete()
                except Exception:
                    pass
                db.commit()

            # Ensure TATASTEEL exists as its own symbol
            tatasteel_row = db.query(MarketSymbolDB).filter(MarketSymbolDB.symbol == "TATASTEEL").first()
            if not tatasteel_row:
                db.add(MarketSymbolDB(
                    symbol="TATASTEEL",
                    ticker="TATASTEEL.NS",
                    name="Tata Steel Limited",
                    category="EQUITY",
                    exchange="NSE",
                    currency="₹",
                    description="Tata Steel Limited engages in steel manufacturing.",
                    is_active=True,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                ))
                db.commit()

            # Ensure TATSILV alias exists
            tatsilv_row = db.query(MarketSymbolDB).filter(MarketSymbolDB.symbol == "TATSILV").first()
            if not tatsilv_row:
                db.add(MarketSymbolDB(
                    symbol="TATSILV",
                    ticker="TATSILV.NS",
                    name="Tata Silver ETF",
                    category="ETF",
                    exchange="NSE",
                    currency="₹",
                    description="Tata Silver Exchange Traded Fund.",
                    is_active=True,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                ))
                db.commit()

        # Update any existing wishlist item for TATASIL
        wl_tatasil = db.query(WishlistDB).filter(WishlistDB.symbol == "TATASIL").first()
        if wl_tatasil and "Steel" in wl_tatasil.name:
            wl_tatasil.name = "Tata Silver ETF"
            wl_tatasil.category = "ETF"
            wl_tatasil.target_buy_price = 20.5
            wl_tatasil.notes = "Core silver commodity holding. Track domestic physical silver price."
            db.commit()

        # Check and seed default wishlist items for demo user
        wl_count = db.query(WishlistDB).count()
        if wl_count == 0:
            initial_wishlists = [
                WishlistDB(
                    id="wl_usr_demo_01_tatasil",
                    user_id="usr_demo_01",
                    symbol="TATASIL",
                    name="Tata Silver ETF",
                    category="ETF",
                    target_buy_price=20.5,
                    notes="Core silver commodity holding. Track domestic physical silver price.",
                    added_at=datetime.utcnow()
                ),
                WishlistDB(
                    id="wl_usr_demo_01_nifty50",
                    user_id="usr_demo_01",
                    symbol="NIFTY50",
                    name="NIFTY 50 Index",
                    category="INDEX",
                    target_buy_price=None,
                    notes="Benchmark index tracker.",
                    added_at=datetime.utcnow()
                ),
                WishlistDB(
                    id="wl_usr_demo_01_reliance",
                    user_id="usr_demo_01",
                    symbol="RELIANCE",
                    name="Reliance Industries Ltd",
                    category="EQUITY",
                    target_buy_price=2850.0,
                    notes="Energy & retail momentum.",
                    added_at=datetime.utcnow()
                )
            ]
            db.add_all(initial_wishlists)
            print("[Database Seed] Seeded default user wishlist records.")

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Database Seed Error]: {e}")
    finally:
        db.close()
