export type StrategyType = "aggressive" | "balanced" | "conservative";

export interface MarketTick {
  symbol: string;
  price: number;
  volume: number;
  timestamp: Date;
}

export interface SentimentSnapshot {
  source: string;
  score: number; // range -1..1
  confidence: number; // 0..1
  timestamp: Date;
}

export interface Position {
  symbol: string;
  amount: number;
  entryPrice: number;
  timestamp: Date;
}

export interface PortfolioState {
  cash: number;
  holdings: Record<string, Position>;
  realizedPnl: number;
  unrealizedPnl: number;
}

export interface StrategyContext {
  market: MarketTick;
  sentiment: SentimentSnapshot[];
  portfolio: PortfolioState;
  config: StrategyRuntimeConfig;
}

export interface TradeDecision {
  action: "BUY" | "SELL" | "HOLD";
  size: number; // base currency amount to buy or sell
  reason: string;
  confidence: number;
  stopLoss?: number;
  takeProfit?: number;
  holdPeriodMinutes?: number;
}

export interface StrategyRuntimeConfig {
  allocation: number;
  maxDrawdown: number;
  dailyLossLimit: number;
  riskBudget: number;
}

export interface TradeRecord {
  strategy: StrategyType;
  timestamp: Date;
  action: "BUY" | "SELL";
  price: number;
  size: number;
  fees: number;
  reason: string;
  confidence: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface DailyPerformance {
  strategy: StrategyType;
  date: string;
  pnl: number;
  returnPct: number;
  maxDrawdownPct: number;
  trades: number;
}

export interface AccountSnapshot {
  strategy: StrategyType;
  timestamp: Date;
  equity: number;
  cash: number;
  exposure: number;
}
