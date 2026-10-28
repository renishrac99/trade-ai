import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from auth_utils import init_db_and_seed

# Initialize DB and seed
init_db_and_seed()
client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Online"
    assert data["auth"] == "JWT Bearer Active"

def test_unauthenticated_requests_rejected():
    """Verify that protected endpoints reject unauthenticated requests with 401 or 403."""
    res_portfolio = client.get("/api/portfolio")
    assert res_portfolio.status_code in [401, 403]

    res_admin = client.get("/api/admin/users")
    assert res_admin.status_code in [401, 403]

    res_wishlist = client.get("/api/wishlist")
    assert res_wishlist.status_code in [401, 403]

    res_pine = client.get("/api/pinescript")
    assert res_pine.status_code in [401, 403]

    res_multi_agent = client.get("/api/forecast/TATASIL/multi-agent-analysis")
    assert res_multi_agent.status_code in [401, 403]

def test_public_stock_endpoints():
    """Verify that stock listing, symbol detail, and search endpoints are publicly accessible."""
    res_stocks = client.get("/api/stocks")
    assert res_stocks.status_code == 200
    assert isinstance(res_stocks.json(), list)

    res_search = client.get("/api/stocks/search?q=tatsilv")
    assert res_search.status_code == 200
    assert isinstance(res_search.json(), list)

    res_detail = client.get("/api/stocks/TATASIL")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["symbol"] == "TATASIL"
    assert detail["category"] == "ETF"
    assert "Silver" in detail["name"]
    assert detail["current_price"] < 50.0  # Tata Silver ETF ~ 21.31, NOT Tata Steel 164+

    res_steel = client.get("/api/stocks/TATASTEEL")
    assert res_steel.status_code == 200
    steel_detail = res_steel.json()
    assert steel_detail["symbol"] == "TATASTEEL"
    assert steel_detail["category"] == "EQUITY"
    assert "Steel" in steel_detail["name"]
    assert steel_detail["current_price"] > 100.0  # Tata Steel ~ 164-175

def test_user_login_and_protected_access():
    # Login as trader
    login_res = client.post("/api/auth/login", json={
        "email": "trader@tradeai.app",
        "password": "TraderPassword@123"
    })
    assert login_res.status_code == 200
    auth_data = login_res.json()
    token = auth_data["token"]
    assert len(token) > 20
    assert auth_data["user"]["role"] == "user"

    headers = {"Authorization": f"Bearer {token}"}

    # Access stocks with token
    stocks_res = client.get("/api/stocks", headers=headers)
    assert stocks_res.status_code == 200
    stocks = stocks_res.json()
    assert len(stocks) > 0
    symbols = [s["symbol"] for s in stocks]
    assert "TATASIL" in symbols

    # Access stock detail
    detail_res = client.get("/api/stocks/TATASIL", headers=headers)
    assert detail_res.status_code == 200
    assert detail_res.json()["symbol"] == "TATASIL"

    # Access morning signals
    signals_res = client.get("/api/forecast/morning-signals", headers=headers)
    assert signals_res.status_code == 200
    assert len(signals_res.json()) > 0

    # Access TimesFM forecast
    timesfm_res = client.get("/api/forecast/TATASIL/timesfm-predict", headers=headers)
    assert timesfm_res.status_code == 200
    assert "Google TimesFM 3.0" in timesfm_res.json()["model"]

    # Access portfolio
    port_res = client.get("/api/portfolio", headers=headers)
    assert port_res.status_code == 200

    # Verify user CANNOT access admin panel (403 Forbidden)
    admin_res = client.get("/api/admin/users", headers=headers)
    assert admin_res.status_code == 403
    assert "Admin privilege required" in admin_res.json()["detail"]

    # Test Token Refresh
    refresh_res = client.post("/api/auth/refresh", headers=headers)
    assert refresh_res.status_code == 200
    new_token = refresh_res.json()["token"]
    assert len(new_token) > 20

    # Test Logout
    logout_res = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {new_token}"})
    assert logout_res.status_code == 200
    assert logout_res.json()["status"] == "success"

def test_admin_rbac_and_management():
    # Login as admin
    admin_login = client.post("/api/auth/login", json={
        "email": "admin@tradeai.app",
        "password": "AdminPassword@123"
    })
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Get admin stats
    stats_res = client.get("/api/admin/stats", headers=admin_headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_users"] >= 2
    assert stats["admin_users"] >= 1

    # List all users
    users_res = client.get("/api/admin/users", headers=admin_headers)
    assert users_res.status_code == 200
    users = users_res.json()
    assert len(users) >= 2

    # Check audit logs
    audit_res = client.get("/api/admin/audit-logs", headers=admin_headers)
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert len(logs) > 0

def test_signup_flow():
    import uuid
    rand_name = f"user_{uuid.uuid4().hex[:6]}"
    signup_res = client.post("/api/auth/signup", json={
        "username": rand_name,
        "email": f"{rand_name}@tradeai.app",
        "password": "SecurePassword@123",
        "full_name": "Test Trader"
    })
    assert signup_res.status_code == 200
    data = signup_res.json()
    assert data["user"]["username"] == rand_name
    assert "token" in data

def test_multi_agent_pipeline():
    # Login as trader
    login_res = client.post("/api/auth/login", json={
        "email": "trader@tradeai.app",
        "password": "TraderPassword@123"
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Execute Multi-Agent Analysis
    res = client.post(
        "/api/forecast/multi-agent-analyze",
        json={"symbol": "TATASIL", "horizon": 7, "risk_tolerance": "AGGRESSIVE"},
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["symbol"] == "TATASIL"
    assert "final_signal" in data
    assert data["final_signal"]["action"] in ["STRONG BUY", "BUY", "HOLD", "SELL", "STRONG SELL"]
    assert "timesfm_forecast" in data
    assert len(data["timesfm_forecast"]["forecast_points"]) == 7
    assert "gemini_reasoning" in data
    assert "agent_execution_traces" in data
    assert len(data["agent_execution_traces"]) == 6 # All 6 agents executed

def test_market_symbols_db_and_sync():
    """Verify that market symbols are stored in DB, fetched dynamically, and can be synced."""
    login_res = client.post("/api/auth/login", json={
        "email": "trader@tradeai.app",
        "password": "TraderPassword@123"
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch database-monitored symbols list
    sym_res = client.get("/api/stocks/symbols/list", headers=headers)
    assert sym_res.status_code == 200
    syms = sym_res.json()
    assert len(syms) > 0
    symbols_list = [s["symbol"] for s in syms]
    assert "TATASIL" in symbols_list
    assert "RELIANCE" in symbols_list

def test_predictions_db_storage_and_query():
    """Verify that predictions are stored in DB upon calculation and can be queried via API."""
    login_res = client.post("/api/auth/login", json={
        "email": "trader@tradeai.app",
        "password": "TraderPassword@123"
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Trigger live stock detail calculation which triggers prediction & DB persistence
    detail_res = client.get("/api/stocks/TATASIL", headers=headers)
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["symbol"] == "TATASIL"
    assert "forecast_1d" in detail_data
    assert "forecast_next_week" in detail_data

    # 2. Query latest prediction from DB
    latest_res = client.get("/api/forecast/predictions/latest/TATASIL", headers=headers)
    assert latest_res.status_code == 200
    latest_pred = latest_res.json()
    assert latest_pred["symbol"] == "TATASIL"
    assert "target_price" in latest_pred
    assert "forecast_1d" in latest_pred
    assert "forecast_7d" in latest_pred
    assert latest_pred["current_price"] > 0

    # 3. Query prediction history
    history_res = client.get("/api/forecast/predictions/history?limit=10", headers=headers)
    assert history_res.status_code == 200
    history = history_res.json()
    assert len(history) > 0
    assert any(h["symbol"] == "TATASIL" for h in history)

def test_trade_data_db_caching_and_persistence():
    """Verify that trade data is persisted to DB upon fetch and reused directly from system."""
    from live_market_service import LiveMarketService
    from database import SessionLocal
    from db_models import TradeDataDB

    # 1. Fetch stock detail (fetches and writes to DB)
    detail = LiveMarketService.fetch_live_stock_detail("RELIANCE")
    assert detail is not None
    assert detail.symbol == "RELIANCE"
    assert detail.current_price > 0

    # 2. Check that it is stored in database
    db_session = SessionLocal()
    trade_row = db_session.query(TradeDataDB).filter(TradeDataDB.symbol == "RELIANCE").first()
    db_session.close()
    assert trade_row is not None
    assert trade_row.symbol == "RELIANCE"
    assert trade_row.current_price > 0
    assert "1M" in trade_row.historical_data

    # 3. Test get_trade_data_from_db directly retrieves and constructs StockDetail from DB
    loaded = LiveMarketService.get_trade_data_from_db("RELIANCE", max_age_seconds=3600)
    assert loaded is not None
    assert loaded.symbol == "RELIANCE"
    assert loaded.current_price == trade_row.current_price
    assert len(loaded.forecast_next_week) == 7
    assert len(loaded.forecast_1d) > 0
    assert loaded.morning_signal is not None

def test_wishlist_db_crud_and_endpoints():
    """Verify that wishlist items are managed properly with DB schema and REST endpoints."""
    # Login as trader
    login_res = client.post("/api/auth/login", json={
        "email": "trader@tradeai.app",
        "password": "TraderPassword@123"
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Ensure TATASIL is present for test idempotency
    client.post("/api/wishlist", json={
        "symbol": "TATASIL",
        "name": "Tata Steel Limited",
        "category": "EQUITY"
    }, headers=headers)

    # Get wishlist
    wl_res = client.get("/api/wishlist", headers=headers)
    assert wl_res.status_code == 200
    items = wl_res.json()
    assert len(items) >= 1
    symbols = [i["symbol"] for i in items]
    assert "TATASIL" in symbols

    # 2. Add new item to wishlist with target buy price and notes
    add_res = client.post("/api/wishlist", json={
        "symbol": "TCS",
        "name": "Tata Consultancy Services",
        "category": "EQUITY",
        "target_buy_price": 4100.00,
        "notes": "Key IT sector heavy-weight."
    }, headers=headers)
    assert add_res.status_code == 200
    added_item = add_res.json()
    assert added_item["symbol"] == "TCS"
    assert added_item["target_buy_price"] == 4100.00
    assert added_item["notes"] == "Key IT sector heavy-weight."

    # 3. Check symbol status
    check_res = client.get("/api/wishlist/check/TCS", headers=headers)
    assert check_res.status_code == 200
    assert check_res.json()["is_wishlisted"] is True

    # 4. Update wishlist item
    update_res = client.put("/api/wishlist/TCS", json={
        "target_buy_price": 4050.00,
        "notes": "Updated buy target on dip."
    }, headers=headers)
    assert update_res.status_code == 200
    assert update_res.json()["target_buy_price"] == 4050.00

    # 5. Toggle wishlist (should remove TCS)
    toggle_res = client.post("/api/wishlist/toggle?symbol=TCS", headers=headers)
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_wishlisted"] is False
    assert toggle_res.json()["status"] == "removed"

    # 6. Delete explicit item
    del_res = client.delete("/api/wishlist/TATASIL", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "removed"

def test_pine_script_engine_and_endpoints():
    """Verify that Pine Script generation, database storage, queries, and file downloads work seamlessly."""
    # Login as trader
    login_res = client.post("/api/auth/login", json={
        "email": "trader@tradeai.app",
        "password": "TraderPassword@123"
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Get presets
    presets_res = client.get("/api/pinescript/presets")
    assert presets_res.status_code == 200
    presets = presets_res.json()
    assert len(presets) >= 5
    preset_ids = [p["id"] for p in presets]
    assert "TIMESFM_NEURAL_BANDS" in preset_ids
    assert "PREMARKET_MOMENTUM" in preset_ids
    assert "SUPER_TREND_VOLATILITY" in preset_ids

    # 2. Generate Pine Script code for TIMESFM_NEURAL_BANDS
    gen_res = client.post("/api/pinescript/generate", json={
        "symbol": "TATASIL",
        "strategy_preset": "TIMESFM_NEURAL_BANDS",
        "script_type": "strategy",
        "timeframe": "15m",
        "pine_version": "v5",
        "inputs": {"atr_length": 14, "atr_multiplier": 2.0}
    }, headers=headers)
    assert gen_res.status_code == 200
    gen_data = gen_res.json()
    assert "//@version=5" in gen_data["code"]
    assert "strategy(" in gen_data["code"]
    assert "TATASIL" in gen_data["code"]
    assert "backtest_stats" in gen_data
    assert gen_data["backtest_stats"]["win_rate"] > 0

    # 3. Save Pine Script to Database
    save_res = client.post("/api/pinescript/save", json={
        "title": "Tata Steel TimesFM Neural Strategy",
        "symbol": "TATASIL",
        "script_type": "strategy",
        "strategy_preset": "TIMESFM_NEURAL_BANDS",
        "timeframe": "15m",
        "pine_version": "v5",
        "code": gen_data["code"],
        "description": "Multi-horizon neural quantile bands strategy",
        "inputs": {"atr_length": 14, "atr_multiplier": 2.0},
        "backtest_stats": gen_data["backtest_stats"]
    }, headers=headers)
    assert save_res.status_code == 200
    saved_item = save_res.json()
    script_id = saved_item["id"]
    assert script_id is not None
    assert saved_item["symbol"] == "TATASIL"

    # 4. Query saved pine scripts list
    list_res = client.get("/api/pinescript", headers=headers)
    assert list_res.status_code == 200
    scripts = list_res.json()
    assert len(scripts) > 0
    assert any(s["id"] == script_id for s in scripts)

    # 5. Get script by ID
    get_res = client.get(f"/api/pinescript/{script_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == script_id

    # 6. Update script title/code
    upd_res = client.put(f"/api/pinescript/{script_id}", json={
        "title": "Tata Steel TimesFM Neural Strategy v2"
    }, headers=headers)
    assert upd_res.status_code == 200
    assert upd_res.json()["title"] == "Tata Steel TimesFM Neural Strategy v2"

    # 7. Test download endpoint
    dl_res = client.get(f"/api/pinescript/download/{script_id}", headers=headers)
    assert dl_res.status_code == 200
    assert "//@version=5" in dl_res.text

    # 8. Delete script
    del_res = client.delete(f"/api/pinescript/{script_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

def test_live_news_debug_and_history_endpoints():
    """Verify live news debug metrics and HTTP backfill endpoint."""
    res_debug = client.get("/api/news/debug")
    assert res_debug.status_code == 200
    debug_data = res_debug.json()
    assert "history_len" in debug_data
    assert "subscribers" in debug_data
    assert "cache_len" in debug_data

    res_history = client.get("/api/news/history")
    assert res_history.status_code == 200
    history_data = res_history.json()
    assert "count" in history_data
    assert "news" in history_data
    assert isinstance(history_data["news"], list)
    assert len(history_data["news"]) > 0
    first_item = history_data["news"][0]
    assert "headline" in first_item
    assert "analysis" in first_item
    assert "asset" in first_item["analysis"]
    assert "impact" in first_item["analysis"]
    assert first_item["analysis"]["impact"] in ["bullish", "bearish", "neutral"]

def test_live_news_ai_heuristics():
    """Verify AI extraction with bullish, bearish and neutral scenarios."""
    from services.news_service import analyze_impact_with_ai
    
    bullish_result = analyze_impact_with_ai("TCS bags $1.2B mega deal from European enterprise; shares rise 3%")
    assert bullish_result is not None
    assert bullish_result["asset"] in ["TCS", "MARKET"]
    assert bullish_result["impact"] == "bullish"
    assert "reason" in bullish_result

    bearish_result = analyze_impact_with_ai("Crude oil drops 4% amid inventory surge and economic slump")
    assert bearish_result is not None
    assert bearish_result["impact"] in ["bearish", "neutral"]

def test_live_news_websocket_stream():
    """Verify WebSocket client handshake and historical backfill transmission."""
    with client.websocket_connect("/api/news/live") as websocket:
        data = websocket.receive_json()
        assert "headline" in data
        assert "analysis" in data
        assert "asset" in data["analysis"]
        assert "impact" in data["analysis"]






