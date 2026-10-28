export interface PricePoint {
  timestamp: string;
  time_label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ForecastPoint {
  day: number;
  date: string;
  day_name: string;
  predicted_close: number;
  upper_bound: number;
  lower_bound: number;
  confidence_pct: number;
  trend: 'UP' | 'DOWN' | 'FLAT';
}

export interface MorningSignal {
  id: string;
  symbol: string;
  name: string;
  date: string;
  generated_at: string;
  action: 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL';
  current_price: number;
  target_price: number;
  stop_loss: number;
  expected_roi_pct: number;
  confidence: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  rationale: string;
  technical_catalysts: string[];
  sentiment_score: number;
  rsi: number;
  macd_signal: string;
  currency?: string;
}

export interface StockSummary {
  symbol: string;
  name: string;
  category: 'ETF' | 'EQUITY' | 'INDEX' | 'CRYPTO';
  exchange: string;
  current_price: number;
  change_amount: number;
  change_pct: number;
  currency: string;
  volume_24h: string;
  market_cap: string;
  sparkline: number[];
  morning_signal?: MorningSignal;
  previous_close?: number;
  today_open?: number;
  day_high?: number;
  day_low?: number;
}

export interface StockDetail extends StockSummary {
  description: string;
  week_high_52: number;
  week_low_52: number;
  day_high: number;
  day_low: number;
  pe_ratio?: number;
  historical_data: { [timeframe: string]: PricePoint[] };
  forecast_next_week: ForecastPoint[];
  forecast_1d?: ForecastPoint[];
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  is_active: boolean;
  avatar_url?: string;
  risk_tolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  morning_alert_time: string;
  enable_push_notifications: boolean;
  watchlist: string[];
}

export interface WishlistItem {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  category: string;
  target_buy_price?: number;
  notes?: string;
  added_at: string;
  current_price?: number;
  change_amount?: number;
  change_pct?: number;
  currency?: string;
  morning_signal_action?: string;
  morning_signal_confidence?: number;
  morning_signal_target?: number;
}

export interface PineScriptPreset {
  id: string;
  name: string;
  category?: string;
  description: string;
  script_type?: string;
  timeframe?: string;
  recommended_timeframe?: string;
  pine_version?: string;
  recommended_indicators?: string[];
  default_params?: any;
  sample_inputs?: any;
}

export interface PineScriptItem {
  id?: string;
  user_id?: string;
  title: string;
  symbol: string;
  script_type: string;
  strategy_preset: string;
  timeframe: string;
  pine_version: string;
  code: string;
  description?: string;
  inputs?: any;
  backtest_stats?: {
    win_rate?: number;
    win_rate_pct?: number;
    profit_factor?: number;
    net_profit_pct?: number;
    net_profit_amount?: number;
    total_trades?: number;
    winning_trades?: number;
    losing_trades?: number;
    max_drawdown_pct?: number;
    sharpe_ratio?: number;
    initial_capital?: number;
    final_equity?: number;
    equity_curve?: Array<{ trade: number; equity: number }>;
  } | any;
  created_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface PortfolioPosition {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  average_buy_price: number;
  current_price: number;
  invested_amount: number;
  current_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  buy_date: string;
}

export interface PortfolioSummary {
  total_invested: number;
  total_current_value: number;
  total_pnl: number;
  total_pnl_pct: number;
  positions: PortfolioPosition[];
}

export interface MarketDigest {
  date: string;
  generated_time: string;
  market_sentiment: string;
  summary: string;
  signals_count: {
    total: number;
    buy: number;
    sell: number;
    hold: number;
  };
  top_pick?: MorningSignal;
}

export interface TimesFMAnalysisResponse {
  symbol: string;
  name: string;
  model: string;
  device: string;
  context_length: number;
  forecast_horizon: number;
  inference_time_ms: number;
  current_price: number;
  predicted_end_price: number;
  predicted_roi_pct: number;
  confidence_score: number;
  quantiles_summary: {
    q10_lower_bound: number;
    q50_point_forecast: number;
    q90_upper_bound: number;
  };
  forecast_points: ForecastPoint[];
  neural_reasoning: string;
  sentiment_index: number;
}

export interface AdminUserItem {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  is_active: boolean;
  avatar_url?: string;
  risk_tolerance: string;
  watchlist_count: number;
  portfolio_balance: number;
  created_at?: string;
  last_login_at?: string;
}

export interface AdminStatsResponse {
  total_users: number;
  active_users: number;
  admin_users: number;
  total_trades: number;
  total_positions: number;
  system_status: string;
  database_dialect: string;
  timesfm_model_status: string;
}

export interface AuditLogItem {
  id: number;
  user_id?: string;
  username?: string;
  action: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}

// Multi-Agent Pipeline Interfaces
export interface AgentStepTrace {
  step: number;
  agent_name: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
  execution_time_ms: number;
  summary: string;
  error?: string;
}

export interface MultiAgentFinalSignal {
  action: 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL';
  target_price: number;
  stop_loss: number;
  expected_roi_pct: number;
  confidence: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  executive_summary: string;
  technical_catalysts: string[];
  sentiment_score: number;
  sentiment_label: string;
}

export interface MultiAgentAnalysisResponse {
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
  current_price: number;
  timestamp: string;
  total_pipeline_time_ms: number;
  final_signal: MultiAgentFinalSignal;
  timesfm_forecast: {
    model: string;
    device: string;
    inference_time_ms: number;
    horizon_days: number;
    predicted_end_price: number;
    quantiles: {
      q10_lower_bound: number;
      q50_point_forecast: number;
      q90_upper_bound: number;
    };
    forecast_points: ForecastPoint[];
    neural_reasoning: string;
  };
  gemini_reasoning: {
    critique: string;
    alignment_status: string;
    hidden_caveats: string[];
    macro_drivers: string;
    engine: string;
  };
  risk_assessment: {
    risk_flags: string[];
    licensing_disclaimer: string;
    volatility_pct: number;
    rsi: number;
  };
  agent_execution_traces: AgentStepTrace[];
}

export interface ComparisonBarPoint {
  time_label: string;
  predicted_close: number;
  actual_close: number;
  lower_bound: number;
  upper_bound: number;
  variance_pct: number;
  variance_amount: number;
  within_confidence_band: boolean;
}

export interface PredictionComparisonResponse {
  symbol: string;
  name: string;
  currency: string;
  predicted_at: string;
  predicted_base_price: number;
  target_price: number;
  stop_loss: number;
  action: string;
  confidence_score: number;
  current_market_price: number;
  price_delta: number;
  price_delta_pct: number;
  directional_accuracy_pct: number;
  target_hit: boolean;
  stop_loss_triggered: boolean;
  status: 'TARGET_HIT' | 'ON_TRACK' | 'ACCURATE_TRACKING' | 'SL_TRIGGERED' | string;
  model_name: string;
  forecast_points: ForecastPoint[];
  comparison_bars: ComparisonBarPoint[];
  summary_text: string;
}

export interface NewsImpactAnalysis {
  asset: string;
  impact: 'bullish' | 'bearish' | 'neutral' | string;
  reason: string;
}

export interface LiveNewsItem {
  headline: string;
  analysis: NewsImpactAnalysis;
  time?: string;
  link?: string;
}


