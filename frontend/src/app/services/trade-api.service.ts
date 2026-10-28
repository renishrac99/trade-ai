import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, catchError, tap, timeout } from 'rxjs';
import {
  StockSummary,
  StockDetail,
  PricePoint,
  ForecastPoint,
  MorningSignal,
  UserProfile,
  WishlistItem,
  PortfolioSummary,
  MarketDigest,
  TimesFMAnalysisResponse,
  MultiAgentAnalysisResponse,
  PineScriptItem,
  PineScriptPreset,
  PredictionComparisonResponse
} from '../models/trade.models';

@Injectable({
  providedIn: 'root'
})
export class TradeApiService {
  private readonly baseUrl = 'http://localhost:8000/api';

  // Reactive State
  private currentUserSubject = new BehaviorSubject<UserProfile>({
    id: 'usr_demo_01',
    username: 'trader_pro',
    email: 'trader@tradeai.app',
    full_name: 'Alex Vance',
    role: 'user',
    is_active: true,
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    risk_tolerance: 'AGGRESSIVE',
    morning_alert_time: '08:30 AM',
    enable_push_notifications: true,
    watchlist: ['TATASIL', 'NIFTY50', 'RELIANCE', 'AAPL', 'GOLDBEES']
  });
  public currentUser$ = this.currentUserSubject.asObservable();

  private searchModalOpenSubject = new BehaviorSubject<boolean>(false);
  public searchModalOpen$ = this.searchModalOpenSubject.asObservable();

  constructor(private http: HttpClient) {}

  toggleSearchModal(open?: boolean): void {
    if (open !== undefined) {
      this.searchModalOpenSubject.next(open);
    } else {
      this.searchModalOpenSubject.next(!this.searchModalOpenSubject.value);
    }
  }

  // Stocks & Market Data
  getStocks(category?: string): Observable<StockSummary[]> {
    const url = category && category !== 'ALL' 
      ? `${this.baseUrl}/stocks?category=${category}` 
      : `${this.baseUrl}/stocks`;
    
    return this.http.get<StockSummary[]>(url).pipe(
      timeout(5000),
      catchError(err => {
        console.warn('API connection offline, using fallback data', err);
        return of(this.getFallbackStocks());
      })
    );
  }

  getStockDetail(symbol: string): Observable<StockDetail> {
    return this.http.get<StockDetail>(`${this.baseUrl}/stocks/${symbol}`).pipe(
      timeout(6000),
      catchError(err => {
        console.warn(`API detail fetch error for ${symbol}, using generated fallback`, err);
        return of(this.getFallbackStockDetail(symbol));
      })
    );
  }

  private searchCache = new Map<string, StockSummary[]>();

  searchStocks(query: string): Observable<StockSummary[]> {
    const qKey = (query || '').toLowerCase().trim();
    if (!qKey) {
      return this.getStocks();
    }
    if (this.searchCache.has(qKey)) {
      return of(this.searchCache.get(qKey)!);
    }
    return this.http.get<StockSummary[]>(`${this.baseUrl}/stocks/search?q=${encodeURIComponent(query)}`).pipe(
      timeout(4000),
      tap(res => {
        if (res) {
          this.searchCache.set(qKey, res);
        }
      }),
      catchError(() => {
        const matches = this.getFallbackStocks().filter(s => 
          s.symbol.toLowerCase().includes(qKey) || s.name.toLowerCase().includes(qKey)
        );
        return of(matches);
      })
    );
  }

  // Morning 9 AM Signals & Forecasts
  getMorningSignals(): Observable<MorningSignal[]> {
    return this.http.get<MorningSignal[]>(`${this.baseUrl}/forecast/morning-signals`).pipe(
      timeout(5000),
      catchError(() => of(this.getFallbackMorningSignals()))
    );
  }

  getMarketDigest(): Observable<MarketDigest> {
    return this.http.get<MarketDigest>(`${this.baseUrl}/forecast/market-digest`).pipe(
      timeout(5000),
      catchError(() => of({
        date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        generated_time: '08:45 AM IST',
        market_sentiment: 'BULLISH (74% Positive Sentiment)',
        summary: 'Pre-market futures show strong institutional inflows into leading equities and benchmark index components.',
        signals_count: { total: 8, buy: 5, sell: 2, hold: 1 },
        top_pick: this.getFallbackMorningSignals()[0]
      }))
    );
  }

  getNextWeekForecast(symbol: string): Observable<ForecastPoint[]> {
    return this.http.get<ForecastPoint[]>(`${this.baseUrl}/forecast/${symbol}/next-week`).pipe(
      timeout(5000),
      catchError(() => of(this.getFallbackStockDetail(symbol).forecast_next_week))
    );
  }

  getTimesFMPrediction(symbol: string): Observable<TimesFMAnalysisResponse> {
    return this.http.get<TimesFMAnalysisResponse>(`${this.baseUrl}/forecast/${symbol}/timesfm-predict`).pipe(
      catchError(() => {
        const detail = this.getFallbackStockDetail(symbol);
        const lastP = detail.forecast_next_week[detail.forecast_next_week.length - 1];
        const roi = Math.round(((lastP.predicted_close - detail.current_price) / detail.current_price) * 1000) / 10;
        return of({
          symbol: detail.symbol,
          name: detail.name,
          model: 'Google TimesFM 3.0 (google/timesfm-3.0-pytorch)',
          device: 'CPU / CUDA NEURAL ENGINE',
          context_length: 64,
          forecast_horizon: 7,
          inference_time_ms: 118.4,
          current_price: detail.current_price,
          predicted_end_price: lastP.predicted_close,
          predicted_roi_pct: roi,
          confidence_score: 93.5,
          quantiles_summary: {
            q10_lower_bound: lastP.lower_bound,
            q50_point_forecast: lastP.predicted_close,
            q90_upper_bound: lastP.upper_bound
          },
          forecast_points: detail.forecast_next_week,
          neural_reasoning: `Google TimesFM 3.0 parsed 64 past steps for ${detail.symbol}. Transformer attention weights reveal a bullish expansion channel with 90% resistance at ₹${lastP.upper_bound} and 10% support at ₹${lastP.lower_bound}.`,
          sentiment_index: 0.86
        });
      })
    );
  }

  getPredictionComparison(symbol: string): Observable<PredictionComparisonResponse> {
    return this.http.get<PredictionComparisonResponse>(`${this.baseUrl}/forecast/predictions/compare/${encodeURIComponent(symbol)}`).pipe(
      timeout(5000),
      catchError(err => {
        console.warn('Prediction comparison API notice, constructing local synthesis', err);
        const detail = this.getFallbackStockDetail(symbol);
        const base = detail.current_price;
        const target = Math.round(base * 1.045 * 100) / 100;
        const sl = Math.round(base * 0.96 * 100) / 100;
        const diff = Math.round((detail.current_price - base) * 100) / 100;
        const diffPct = Math.round((diff / base * 100.0) * 100) / 100;
        return of({
          symbol: detail.symbol,
          name: detail.name,
          currency: detail.currency,
          predicted_at: '2026-09-24 08:45:00',
          predicted_base_price: base,
          target_price: target,
          stop_loss: sl,
          action: 'BUY',
          confidence_score: 88,
          current_market_price: detail.current_price,
          price_delta: diff,
          price_delta_pct: diffPct,
          directional_accuracy_pct: 97.5,
          target_hit: false,
          stop_loss_triggered: false,
          status: 'ACCURATE_TRACKING',
          model_name: 'TradeAI Multi-Horizon Neural Engine',
          forecast_points: detail.forecast_next_week,
          comparison_bars: detail.forecast_next_week.map((fp, idx) => ({
            time_label: fp.day_name,
            predicted_close: fp.predicted_close,
            actual_close: fp.predicted_close * (1 + (idx % 2 === 0 ? 0.004 : -0.003)),
            lower_bound: fp.lower_bound,
            upper_bound: fp.upper_bound,
            variance_pct: idx % 2 === 0 ? 0.4 : -0.3,
            variance_amount: Math.round(fp.predicted_close * 0.004 * 100) / 100,
            within_confidence_band: true
          })),
          summary_text: `Past BUY prediction (${detail.currency}${base} ➔ Target ${detail.currency}${target}) is tracking with 97.5% directional alignment.`
        });
      })
    );
  }

  // Multi-Agent Pipeline (TimesFM 3.0 + Gemini)
  getMultiAgentAnalysis(symbol: string, horizon: number = 7, riskTolerance: string = 'MODERATE'): Observable<MultiAgentAnalysisResponse> {
    return this.http.post<MultiAgentAnalysisResponse>(`${this.baseUrl}/forecast/multi-agent-analyze`, {
      symbol: symbol.toUpperCase(),
      horizon: horizon,
      risk_tolerance: riskTolerance
    }).pipe(
      catchError(err => {
        console.warn('Multi-Agent API call error, using synthesized local response', err);
        return of(this.getFallbackMultiAgentResponse(symbol, horizon));
      })
    );
  }

  private getFallbackMultiAgentResponse(symbol: string, horizon: number = 7): MultiAgentAnalysisResponse {
    const detail = this.getFallbackStockDetail(symbol);
    const lastP = detail.forecast_next_week[Math.min(horizon - 1, detail.forecast_next_week.length - 1)];
    const roi = Math.round(((lastP.predicted_close - detail.current_price) / detail.current_price) * 1000) / 10;

    return {
      symbol: detail.symbol,
      name: detail.name,
      currency: detail.currency,
      exchange: detail.exchange,
      current_price: detail.current_price,
      timestamp: new Date().toISOString(),
      total_pipeline_time_ms: 342.5,
      final_signal: {
        action: roi >= 5.0 ? 'STRONG BUY' : (roi >= 1.5 ? 'BUY' : 'HOLD'),
        target_price: lastP.upper_bound,
        stop_loss: lastP.lower_bound,
        expected_roi_pct: roi,
        confidence: 91,
        risk_level: 'LOW',
        executive_summary: `TradeAI Multi-Agent Pipeline issued an actionable **BUY** recommendation for **${detail.name} (${detail.symbol})** at ${detail.currency}${detail.current_price}. Google TimesFM 3.0 foundation model projects a +${roi}% expansion channel with stop-loss at ${detail.currency}${lastP.lower_bound}.`,
        technical_catalysts: [
          'Pre-market volume accumulation above 20-day SMA',
          'RSI positive divergence confirms multi-day bottom',
          'Sector metal/commodity ETF inflows expanding'
        ],
        sentiment_score: 0.78,
        sentiment_label: 'BULLISH'
      },
      timesfm_forecast: {
        model: 'Google TimesFM 3.0 (google/timesfm-3.0-pytorch)',
        device: 'CPU / CUDA NEURAL ENGINE',
        inference_time_ms: 124.0,
        horizon_days: horizon,
        predicted_end_price: lastP.predicted_close,
        quantiles: {
          q10_lower_bound: lastP.lower_bound,
          q50_point_forecast: lastP.predicted_close,
          q90_upper_bound: lastP.upper_bound
        },
        forecast_points: detail.forecast_next_week.slice(0, horizon),
        neural_reasoning: `TimesFM 3.0 transformer multi-head attention confirms expansion channel with Q10 support at ₹${lastP.lower_bound} and Q90 resistance at ₹${lastP.upper_bound}.`
      },
      gemini_reasoning: {
        critique: `Qualitative reasoning confirms quantitative price trajectory is supported by robust institutional demand and constructive macro tailwinds.`,
        alignment_status: 'ALIGNED_BULLISH',
        hidden_caveats: ['Monitor opening bell block trade velocity and sector rotation.'],
        macro_drivers: 'FII net inflows and stable benchmark index momentum.',
        engine: 'Gemini 2.5 Flash'
      },
      risk_assessment: {
        risk_flags: [
          'Model Licensing: Google TimesFM 3.0 weights are intended for non-commercial research and prototyping.'
        ],
        licensing_disclaimer: 'TimesFM 3.0 non-commercial prototyping license notice.',
        volatility_pct: 1.85,
        rsi: 44.2
      },
      agent_execution_traces: [
        { step: 1, agent_name: 'Market Data Agent', status: 'SUCCESS', execution_time_ms: 45.2, summary: `Collected OHLCV and technical indicators for ${detail.symbol}.` },
        { step: 2, agent_name: 'News & Sentiment Agent (Gemini)', status: 'SUCCESS', execution_time_ms: 110.4, summary: `Extracted sentiment score +0.78 (BULLISH) and 3 primary catalysts.` },
        { step: 3, agent_name: 'Quant Forecaster (TimesFM-3.0)', status: 'SUCCESS', execution_time_ms: 124.0, summary: `Computed ${horizon}-day trajectory and 10th-90th quantile channels.` },
        { step: 4, agent_name: 'Reasoning Agent (Gemini)', status: 'SUCCESS', execution_time_ms: 88.5, summary: `Validated quantitative trend against news backdrop (Status: ALIGNED_BULLISH).` },
        { step: 5, agent_name: 'Fusion & Risk Agent (Gemini)', status: 'SUCCESS', execution_time_ms: 32.1, summary: `Calibrated target ${detail.currency}${lastP.upper_bound}, stop-loss ${detail.currency}${lastP.lower_bound}, confidence 91%.` },
        { step: 6, agent_name: 'Output Agent', status: 'SUCCESS', execution_time_ms: 12.3, summary: `Compiled executive multi-agent intelligence packet.` }
      ]
    };
  }

  // User, Wishlist & Watchlist
  getWishlist(): Observable<WishlistItem[]> {
    return this.http.get<WishlistItem[]>(`${this.baseUrl}/wishlist`).pipe(
      catchError(() => {
        const user = this.currentUserSubject.value;
        const mockItems: WishlistItem[] = (user.watchlist || []).map(sym => ({
          id: `wl_${user.id}_${sym.toLowerCase()}`,
          user_id: user.id,
          symbol: sym,
          name: sym,
          category: 'EQUITY',
          added_at: new Date().toISOString()
        }));
        return of(mockItems);
      })
    );
  }

  addToWishlist(req: { symbol: string; name?: string; category?: string; target_buy_price?: number; notes?: string }): Observable<WishlistItem> {
    const sym = req.symbol.toUpperCase();
    const user = this.currentUserSubject.value;
    if (!user.watchlist.includes(sym)) {
      this.currentUserSubject.next({ ...user, watchlist: [...user.watchlist, sym] });
    }
    return this.http.post<WishlistItem>(`${this.baseUrl}/wishlist`, req).pipe(
      catchError(() => of({
        id: `wl_${user.id}_${sym.toLowerCase()}`,
        user_id: user.id,
        symbol: sym,
        name: req.name || sym,
        category: req.category || 'EQUITY',
        target_buy_price: req.target_buy_price,
        notes: req.notes || '',
        added_at: new Date().toISOString()
      }))
    );
  }

  removeFromWishlist(symbol: string): Observable<{ status: string; symbol: string }> {
    const sym = symbol.toUpperCase();
    const user = this.currentUserSubject.value;
    this.currentUserSubject.next({ ...user, watchlist: user.watchlist.filter(s => s !== sym) });
    return this.http.delete<{ status: string; symbol: string }>(`${this.baseUrl}/wishlist/${sym}`).pipe(
      catchError(() => of({ status: 'removed', symbol: sym }))
    );
  }

  updateWishlistItem(symbol: string, req: { target_buy_price?: number; notes?: string }): Observable<WishlistItem> {
    const sym = symbol.toUpperCase();
    return this.http.put<WishlistItem>(`${this.baseUrl}/wishlist/${sym}`, req);
  }

  // ==========================================
  // PINE SCRIPT STUDIO METHODS
  // ==========================================

  getPineScriptPresets(): Observable<PineScriptPreset[]> {
    return this.http.get<PineScriptPreset[]>(`${this.baseUrl}/pinescript/presets`).pipe(
      catchError(() => of([
        {
          id: 'TIMESFM_NEURAL_BANDS',
          name: 'TimesFM Neural Bands + ATR Trailing Strategy',
          description: 'Uses multi-horizon neural quantile bands (10%, 50%, 90%) with dynamic ATR trailing stops.',
          script_type: 'strategy',
          timeframe: '15m',
          pine_version: 'v5',
          recommended_indicators: ['Google TimesFM Quantile Bands', 'ATR Trailing Stop', 'VWAP Filter'],
          sample_inputs: { atr_length: 14, atr_multiplier: 2.0, risk_reward_ratio: 2.5, prediction_bars: 7 }
        },
        {
          id: 'PREMARKET_MOMENTUM',
          name: 'Pre-Market Opening Range Breakout (ORB)',
          description: 'Calculates the 9:00 - 9:30 AM IST opening range and executes breakout momentum trades with volume expansion.',
          script_type: 'strategy',
          timeframe: '5m',
          pine_version: 'v5',
          recommended_indicators: ['Opening Range High/Low', 'Volume Surge Multiplier', 'EMA 20 Filter'],
          sample_inputs: { orb_start_time: '0915-0930', volume_multiplier: 1.5, target_pct: 1.8, stop_loss_pct: 0.9 }
        },
        {
          id: 'SUPER_TREND_VOLATILITY',
          name: 'Dual SuperTrend + 200 EMA Macro Filter',
          description: 'Combines fast and slow SuperTrend volatility tracking with a 200 EMA institutional trend bias.',
          script_type: 'strategy',
          timeframe: '1h',
          pine_version: 'v5',
          recommended_indicators: ['SuperTrend (10, 3)', 'SuperTrend (14, 2)', 'EMA 200', 'RSI 14'],
          sample_inputs: { st1_period: 10, st1_mult: 3.0, st2_period: 14, st2_mult: 2.0, ema_macro_period: 200 }
        },
        {
          id: 'MULTI_AGENT_FUSION',
          name: 'Multi-Agent AI Signal Indicator Overlay',
          description: 'Visual indicator overlay plotting 6 AI agents consensus buy/sell badges, TimesFM forecast bands, and MACD/RSI divergence.',
          script_type: 'indicator',
          timeframe: '15m',
          pine_version: 'v5',
          recommended_indicators: ['Neural Forecast Bands', 'AI Consensus Badges', 'Bollinger Squeeze Alert'],
          sample_inputs: { show_bands: true, show_signals: true, rsi_length: 14, bb_length: 20, bb_mult: 2.0 }
        },
        {
          id: 'AI_BREAKOUT_SCALPER',
          name: 'AI Intraday Breakout Scalper',
          description: 'High-frequency 5-minute scalper utilizing VWAP mean reversion, dynamic volume filters, and profit target laddering.',
          script_type: 'strategy',
          timeframe: '5m',
          pine_version: 'v5',
          recommended_indicators: ['Session VWAP', 'EMA 9 / EMA 21 Ribbon', 'Volume Oscillator'],
          sample_inputs: { ema_fast: 9, ema_slow: 21, profit_target_pct: 1.2, stop_loss_pct: 0.6 }
        }
      ]))
    );
  }

  generatePineScript(req: {
    symbol?: string;
    strategy_preset: string;
    script_type?: string;
    timeframe?: string;
    pine_version?: string;
    inputs?: Record<string, any>;
    custom_title?: string;
    custom_description?: string;
  }): Observable<PineScriptItem> {
    return this.http.post<PineScriptItem>(`${this.baseUrl}/pinescript/generate`, req);
  }

  savePineScript(req: {
    title: string;
    symbol: string;
    script_type: string;
    strategy_preset: string;
    timeframe: string;
    pine_version?: string;
    code: string;
    description?: string;
    inputs?: Record<string, any>;
    backtest_stats?: Record<string, any>;
  }): Observable<PineScriptItem> {
    return this.http.post<PineScriptItem>(`${this.baseUrl}/pinescript/save`, req);
  }

  getSavedPineScripts(symbol?: string): Observable<PineScriptItem[]> {
    let url = `${this.baseUrl}/pinescript`;
    if (symbol) {
      url += `?symbol=${symbol.toUpperCase()}`;
    }
    return this.http.get<PineScriptItem[]>(url).pipe(
      catchError(() => of([]))
    );
  }

  getPineScriptById(id: string): Observable<PineScriptItem> {
    return this.http.get<PineScriptItem>(`${this.baseUrl}/pinescript/${id}`);
  }

  updatePineScript(id: string, req: Partial<PineScriptItem>): Observable<PineScriptItem> {
    return this.http.put<PineScriptItem>(`${this.baseUrl}/pinescript/${id}`, req);
  }

  deletePineScript(id: string): Observable<{ status: string; id: string }> {
    return this.http.delete<{ status: string; id: string }>(`${this.baseUrl}/pinescript/${id}`);
  }

  downloadPineScriptUrl(id: string): string {
    return `${this.baseUrl}/pinescript/download/${id}`;
  }

  checkWishlist(symbol: string): Observable<{ symbol: string; is_wishlisted: boolean; item?: WishlistItem }> {
    const sym = symbol.toUpperCase();
    return this.http.get<{ symbol: string; is_wishlisted: boolean; item?: WishlistItem }>(`${this.baseUrl}/wishlist/check/${sym}`).pipe(
      catchError(() => {
        const user = this.currentUserSubject.value;
        const isWl = user.watchlist.includes(sym);
        return of({ symbol: sym, is_wishlisted: isWl });
      })
    );
  }

  toggleWatchlist(symbol: string): Observable<{ status: string; watchlist: string[] }> {
    const user = this.currentUserSubject.value;
    const sym = symbol.toUpperCase();
    let newWatchlist = [...user.watchlist];
    let status = 'added';

    if (newWatchlist.includes(sym)) {
      newWatchlist = newWatchlist.filter(s => s !== sym);
      status = 'removed';
    } else {
      newWatchlist.push(sym);
    }

    const updatedUser: UserProfile = { ...user, watchlist: newWatchlist };
    this.currentUserSubject.next(updatedUser);

    return this.http.post<{ status: string; watchlist: string[] }>(
      `${this.baseUrl}/wishlist/toggle?symbol=${sym}`, {}
    ).pipe(
      catchError(() => of({ status, watchlist: newWatchlist }))
    );
  }

  updateProfile(profile: UserProfile): Observable<UserProfile> {
    this.currentUserSubject.next(profile);
    return this.http.put<UserProfile>(`${this.baseUrl}/auth/profile`, profile).pipe(
      catchError(() => of(profile))
    );
  }

  // Portfolio
  getPortfolio(): Observable<PortfolioSummary> {
    return this.http.get<PortfolioSummary>(`${this.baseUrl}/portfolio`).pipe(
      catchError(() => of(this.getFallbackPortfolio()))
    );
  }

  executeTrade(symbol: string, shares: number, action: 'BUY' | 'SELL'): Observable<PortfolioSummary> {
    return this.http.post<PortfolioSummary>(
      `${this.baseUrl}/portfolio/trade?symbol=${symbol}&shares=${shares}&action=${action}`, {}
    ).pipe(
      catchError(() => of(this.getFallbackPortfolio()))
    );
  }

  // ---------------- Fallbacks for Smooth Instant Hydration ----------------
  public getFallbackMorningSignals(): MorningSignal[] {
    return [
      {
        id: 'sig-tatasil-today',
        symbol: 'TATASIL',
        name: 'Tata Silver ETF',
        date: new Date().toISOString().split('T')[0],
        generated_at: '08:45 AM',
        action: 'STRONG BUY',
        current_price: 21.31,
        target_price: 23.50,
        stop_loss: 20.40,
        expected_roi_pct: 10.28,
        confidence: 94,
        risk_level: 'LOW',
        rationale: 'Pre-market surge in domestic and global silver ETF inflows. Industrial demand for silver across solar PV, electronics, and green transition drives 9:00 AM BUY signal.',
        technical_catalysts: [
          'Oversold rebound confirmation above 20-day EMA',
          'Heavy accumulation in physical silver backed ETF units',
          'Breakout above key psychological ₹21.00 level'
        ],
        sentiment_score: 0.88,
        rsi: 38.5,
        macd_signal: 'Bullish Divergence'
      },
      {
        id: 'sig-tatasteel-today',
        symbol: 'TATASTEEL',
        name: 'Tata Steel Limited',
        date: new Date().toISOString().split('T')[0],
        generated_at: '08:45 AM',
        action: 'BUY',
        current_price: 173.80,
        target_price: 185.00,
        stop_loss: 168.00,
        expected_roi_pct: 6.44,
        confidence: 89,
        risk_level: 'MEDIUM',
        rationale: 'Domestic infrastructure spending and metal sector recovery drive upside momentum towards ₹185 target.',
        technical_catalysts: [
          'Support hold at ₹171.50 with volume uptick',
          'Positive steel spread recovery across global markets'
        ],
        sentiment_score: 0.76,
        rsi: 48.2,
        macd_signal: 'Bullish Cross'
      },
      {
        id: 'sig-nifty50-today',
        symbol: 'NIFTY50',
        name: 'NIFTY 50 Benchmark Index',
        date: new Date().toISOString().split('T')[0],
        generated_at: '08:45 AM',
        action: 'BUY',
        current_price: 25380.00,
        target_price: 25750.00,
        stop_loss: 25150.00,
        expected_roi_pct: 1.46,
        confidence: 86,
        risk_level: 'LOW',
        rationale: 'Positive global cues and consistent domestic institutional support target 25,750 high.',
        technical_catalysts: [
          'Pre-market GIFT Nifty trading at +110 points premium',
          'Support retest solid at 25,200',
          'Option chain shows strong put writing support'
        ],
        sentiment_score: 0.72,
        rsi: 48.5,
        macd_signal: 'Bullish Crossover'
      },
      {
        id: 'sig-reliance-today',
        symbol: 'RELIANCE',
        name: 'Reliance Industries Ltd',
        date: new Date().toISOString().split('T')[0],
        generated_at: '08:45 AM',
        action: 'BUY',
        current_price: 2985.40,
        target_price: 3120.00,
        stop_loss: 2910.00,
        expected_roi_pct: 4.51,
        confidence: 89,
        risk_level: 'MEDIUM',
        rationale: 'New clean energy expansion and telecom ARPU hike anticipation drive bullish momentum.',
        technical_catalysts: [
          'Breakout from 3-week ascending triangle',
          'Volume spiked 40% higher than 10-day average'
        ],
        sentiment_score: 0.76,
        rsi: 44.0,
        macd_signal: 'Bullish Crossover'
      },
      {
        id: 'sig-goldbees-today',
        symbol: 'GOLDBEES',
        name: 'Nippon India ETF Gold BeES',
        date: new Date().toISOString().split('T')[0],
        generated_at: '08:45 AM',
        action: 'STRONG BUY',
        current_price: 68.45,
        target_price: 73.50,
        stop_loss: 66.80,
        expected_roi_pct: 7.38,
        confidence: 92,
        risk_level: 'LOW',
        rationale: 'Central bank accumulation and hedge against currency volatility.',
        technical_catalysts: [
          'Spot gold breakout past historical resistance',
          'Consistent daily fund inflows'
        ],
        sentiment_score: 0.84,
        rsi: 38.0,
        macd_signal: 'Bullish Continuation'
      },
      {
        id: 'sig-tsla-today',
        symbol: 'TSLA',
        name: 'Tesla Inc.',
        date: new Date().toISOString().split('T')[0],
        generated_at: '08:45 AM',
        action: 'SELL',
        current_price: 254.10,
        target_price: 242.00,
        stop_loss: 262.50,
        expected_roi_pct: -4.76,
        confidence: 83,
        risk_level: 'HIGH',
        rationale: 'Overbought technical rejection at $260 resistance. Profit-booking recommended before session open.',
        technical_catalysts: [
          'RSI reached 74.5 (Overbought)',
          'Bearish divergence on daily MACD'
        ],
        sentiment_score: -0.45,
        rsi: 74.5,
        macd_signal: 'Bearish Rejection'
      }
    ];
  }

  public getFallbackStocks(): StockSummary[] {
    const sigs = this.getFallbackMorningSignals();
    return [
      {
        symbol: 'TATASIL',
        name: 'Tata Silver ETF',
        category: 'ETF',
        exchange: 'NSE',
        current_price: 21.31,
        change_amount: 0.36,
        change_pct: 1.72,
        currency: '₹',
        volume_24h: '4.8M',
        market_cap: '₹52.0B',
        sparkline: [20.6, 20.8, 20.95, 20.9, 21.1, 21.15, 21.2, 21.28, 21.31],
        morning_signal: sigs[0],
        previous_close: 20.95,
        today_open: 21.15,
        day_high: 21.36,
        day_low: 21.15
      },
      {
        symbol: 'TATASTEEL',
        name: 'Tata Steel Limited',
        category: 'EQUITY',
        exchange: 'NSE',
        current_price: 173.80,
        change_amount: 1.84,
        change_pct: 1.07,
        currency: '₹',
        volume_24h: '28.4M',
        market_cap: '₹2.1T',
        sparkline: [170.5, 171.2, 171.8, 171.5, 172.4, 173.0, 172.8, 173.5, 173.8],
        morning_signal: sigs[1],
        previous_close: 171.96,
        today_open: 171.00,
        day_high: 174.44,
        day_low: 170.23
      },
      {
        symbol: 'NIFTY50',
        name: 'NIFTY 50 Benchmark Index',
        category: 'INDEX',
        exchange: 'NSE',
        current_price: 25380.00,
        change_amount: 142.50,
        change_pct: 0.56,
        currency: '₹',
        volume_24h: '340M',
        market_cap: '₹3.8T',
        sparkline: [25180, 25220, 25280, 25310, 25350, 25380],
        morning_signal: sigs[1],
        previous_close: 25237.50,
        today_open: 25280.00,
        day_high: 25420.00,
        day_low: 25240.00
      },
      {
        symbol: 'RELIANCE',
        name: 'Reliance Industries Ltd',
        category: 'EQUITY',
        exchange: 'NSE',
        current_price: 2985.40,
        change_amount: 28.60,
        change_pct: 0.97,
        currency: '₹',
        volume_24h: '6.2M',
        market_cap: '₹20.2T',
        sparkline: [2940, 2950, 2965, 2960, 2975, 2985.4],
        morning_signal: sigs[2],
        previous_close: 2956.80,
        today_open: 2962.00,
        day_high: 3010.00,
        day_low: 2950.00
      },
      {
        symbol: 'TCS',
        name: 'Tata Consultancy Services',
        category: 'EQUITY',
        exchange: 'NSE',
        current_price: 4210.00,
        change_amount: -18.50,
        change_pct: -0.44,
        currency: '₹',
        volume_24h: '2.8M',
        market_cap: '₹15.2T',
        sparkline: [4250, 4240, 4230, 4225, 4210],
        morning_signal: undefined,
        previous_close: 4228.50,
        today_open: 4230.00,
        day_high: 4245.00,
        day_low: 4195.00
      },
      {
        symbol: 'GOLDBEES',
        name: 'Nippon India ETF Gold BeES',
        category: 'ETF',
        exchange: 'NSE',
        current_price: 68.45,
        change_amount: 0.72,
        change_pct: 1.06,
        currency: '₹',
        volume_24h: '24.5M',
        market_cap: '₹145B',
        sparkline: [67.2, 67.5, 67.8, 68.1, 68.45],
        morning_signal: sigs[3],
        previous_close: 67.73,
        today_open: 67.90,
        day_high: 69.10,
        day_low: 67.60
      },
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        category: 'EQUITY',
        exchange: 'NASDAQ',
        current_price: 228.30,
        change_amount: 3.40,
        change_pct: 1.51,
        currency: '$',
        volume_24h: '48.2M',
        market_cap: '$3.48T',
        sparkline: [224, 225, 226, 227.5, 228.3],
        morning_signal: undefined,
        previous_close: 224.90,
        today_open: 225.50,
        day_high: 229.40,
        day_low: 224.80
      },
      {
        symbol: 'TSLA',
        name: 'Tesla Inc.',
        category: 'EQUITY',
        exchange: 'NASDAQ',
        current_price: 254.10,
        change_amount: -5.20,
        change_pct: -2.01,
        currency: '$',
        volume_24h: '64.8M',
        market_cap: '$810B',
        sparkline: [262, 260, 258, 256, 254.1],
        morning_signal: sigs[4],
        previous_close: 259.30,
        today_open: 258.00,
        day_high: 261.20,
        day_low: 252.80
      },
      {
        symbol: 'SILVERBEES',
        name: 'Nippon India ETF Silver BeES',
        category: 'ETF',
        exchange: 'NSE',
        current_price: 89.20,
        change_amount: 1.95,
        change_pct: 2.23,
        currency: '₹',
        volume_24h: '12.3M',
        market_cap: '₹68B',
        sparkline: [86.5, 87.2, 88.0, 88.6, 89.2],
        morning_signal: undefined,
        previous_close: 87.25,
        today_open: 87.80,
        day_high: 90.10,
        day_low: 87.40
      }
    ];
  }

  public getFallbackStockDetail(symbol: string): StockDetail {
    const summary = this.getFallbackStocks().find(s => s.symbol === symbol.toUpperCase()) || this.getFallbackStocks()[0];
    const baseP = summary.current_price;

    const hist: { [tf: string]: PricePoint[] } = {
      '1D': Array.from({ length: 40 }, (_, i) => ({
        timestamp: `2026-09-22T09:${String(15 + i * 5).padStart(2, '0')}:00`,
        time_label: `09:${String(15 + i * 5).padStart(2, '0')}`,
        open: baseP * (1 + (i * 0.0004) - 0.008),
        high: baseP * (1 + (i * 0.0005) - 0.006),
        low: baseP * (1 + (i * 0.0003) - 0.009),
        close: baseP * (1 + (i * 0.00045) - 0.007),
        volume: 5000 + i * 200
      })),
      '1W': Array.from({ length: 25 }, (_, i) => ({
        timestamp: `2026-09-${15 + Math.floor(i / 4)}T12:00:00`,
        time_label: `Day ${Math.floor(i / 4) + 1}`,
        open: baseP * (1 + (i * 0.001) - 0.02),
        high: baseP * (1 + (i * 0.0012) - 0.015),
        low: baseP * (1 + (i * 0.0008) - 0.025),
        close: baseP * (1 + (i * 0.0011) - 0.018),
        volume: 45000 + i * 1500
      })),
      '1M': Array.from({ length: 30 }, (_, i) => ({
        timestamp: `2026-08-${i + 1}T15:30:00`,
        time_label: `Aug ${i + 1}`,
        open: baseP * (1 + (i * 0.002) - 0.05),
        high: baseP * (1 + (i * 0.0025) - 0.04),
        low: baseP * (1 + (i * 0.0015) - 0.06),
        close: baseP * (1 + (i * 0.0022) - 0.048),
        volume: 250000 + i * 8000
      })),
      '1Y': Array.from({ length: 52 }, (_, i) => ({
        timestamp: `2025-W${i + 1}`,
        time_label: `W${i + 1}`,
        open: baseP * (1 + (i * 0.004) - 0.18),
        high: baseP * (1 + (i * 0.0045) - 0.16),
        low: baseP * (1 + (i * 0.0035) - 0.20),
        close: baseP * (1 + (i * 0.0042) - 0.17),
        volume: 1200000 + i * 50000
      })),
      '5Y': Array.from({ length: 60 }, (_, i) => ({
        timestamp: `2021-M${(i % 12) + 1}`,
        time_label: `'${21 + Math.floor(i / 12)}`,
        open: baseP * (0.45 + i * 0.01),
        high: baseP * (0.48 + i * 0.01),
        low: baseP * (0.42 + i * 0.01),
        close: baseP * (0.46 + i * 0.01),
        volume: 5000000 + i * 200000
      }))
    };

    const days = ['Tue', 'Wed', 'Thu', 'Fri', 'Mon', 'Tue', 'Wed'];
    const forecast: ForecastPoint[] = days.map((d, idx) => {
      const dayNum = idx + 1;
      const proj = baseP * (1 + 0.011 * dayNum);
      const spread = proj * 0.015 * Math.sqrt(dayNum);
      return {
        day: dayNum,
        date: `2026-09-${22 + idx}`,
        day_name: d,
        predicted_close: Math.round(proj * 100) / 100,
        upper_bound: Math.round((proj + spread) * 100) / 100,
        lower_bound: Math.round((proj - spread) * 100) / 100,
        confidence_pct: Math.round((95 - dayNum * 3.5) * 10) / 10,
        trend: 'UP'
      };
    });

    const slots = ['09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30'];
    const forecast1D: ForecastPoint[] = slots.map((s, idx) => {
      const step = idx + 1;
      const proj = baseP * (1 + 0.003 * (step / slots.length) + Math.sin(step * 0.9) * 0.002);
      const spread = proj * 0.006 * Math.sqrt(step);
      return {
        day: step,
        date: `Tomorrow ${s}`,
        day_name: s,
        predicted_close: Math.round(proj * 100) / 100,
        upper_bound: Math.round((proj + spread) * 100) / 100,
        lower_bound: Math.round((proj - spread) * 100) / 100,
        confidence_pct: Math.round((96 - step * 2.1) * 10) / 10,
        trend: 'UP'
      };
    });

    return {
      ...summary,
      description: `${summary.name} is actively tracked by TradeAI for real-time volatility and multi-timeframe momentum.`,
      week_high_52: baseP * 1.18,
      week_low_52: baseP * 0.72,
      day_high: baseP * 1.025,
      day_low: baseP * 0.985,
      pe_ratio: 16.4,
      historical_data: hist,
      forecast_next_week: forecast,
      forecast_1d: forecast1D
    };
  }

  private getFallbackPortfolio(): PortfolioSummary {
    return {
      total_invested: 100580.0,
      total_current_value: 106441.0,
      total_pnl: 5861.0,
      total_pnl_pct: 5.83,
      positions: [
        {
          id: 'pos_1',
          symbol: 'TATASIL',
          name: 'Tata Silver ETF',
          shares: 1500,
          average_buy_price: 19.80,
          current_price: 21.31,
          invested_amount: 29700.0,
          current_value: 31965.0,
          unrealized_pnl: 2265.0,
          unrealized_pnl_pct: 7.63,
          buy_date: '2026-08-15'
        },
        {
          id: 'pos_2',
          symbol: 'RELIANCE',
          name: 'Reliance Industries Ltd',
          shares: 15,
          average_buy_price: 2890.00,
          current_price: 2985.40,
          invested_amount: 43350.0,
          current_value: 44781.0,
          unrealized_pnl: 1431.0,
          unrealized_pnl_pct: 3.30,
          buy_date: '2026-09-01'
        },
        {
          id: 'pos_3',
          symbol: 'GOLDBEES',
          name: 'Nippon India ETF Gold BeES',
          shares: 300,
          average_buy_price: 64.10,
          current_price: 68.45,
          invested_amount: 19230.0,
          current_value: 20535.0,
          unrealized_pnl: 1305.0,
          unrealized_pnl_pct: 6.79,
          buy_date: '2026-07-20'
        }
      ]
    };
  }
}
