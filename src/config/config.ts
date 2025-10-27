import { StrategyType } from "../types.ts";
import { safeGetEnv } from "../utils/env.ts";

export type ExchangeProvider = "mock" | "okx";
export type TradingMode = "backtest" | "live";

export interface MockExchangeConfig {
  initialPrice: number;
  volatility: number;
  priceDrift: number;
}

export interface OkxExchangeConfig {
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
  baseUrl: string;
}

export interface ExchangeConfig {
  provider: ExchangeProvider;
  mock?: MockExchangeConfig;
  okx?: OkxExchangeConfig;
}

export interface StrategyConfig {
  type: StrategyType;
  allocation: number;
  maxDrawdown: number;
  dailyLossLimit: number;
  riskBudget: number;
  targetDailyReturn: number;
}

export interface LiveTradingConfig {
  intervalMinutes: number; // 交易决策间隔（分钟）
  maxIterations?: number; // 最大迭代次数，不设置则无限运行
  stopOnError: boolean; // 遇到错误是否停止
  reconnectAttempts: number; // API 失败重试次数
  reconnectDelaySeconds: number; // 重试延迟（秒）
}

export interface BacktestConfig {
  iterations: number; // 回测迭代次数
}

export interface AppConfig {
  mode: TradingMode; // 运行模式：回测或实时交易
  baseCurrency: string;
  quoteCurrency: string;
  tradingPair: string;
  startingCapital: number;
  strategies: StrategyConfig[];
  tradingFees: number;
  reportDirectory: string;
  tradeLogPath: string;
  exchange: ExchangeConfig;
  liveTrading: LiveTradingConfig;
  backtest: BacktestConfig;
}

const providerFromEnv = (): ExchangeProvider => {
  const value = safeGetEnv("EXCHANGE_PROVIDER")?.toLowerCase();
  if (value === "okx") {
    return "okx";
  }
  return "mock";
};

const modeFromEnv = (): TradingMode => {
  const value = safeGetEnv("TRADING_MODE")?.toLowerCase();
  if (value === "live") {
    return "live";
  }
  return "backtest";
};

const defaultMockConfig: MockExchangeConfig = {
  initialPrice: 28_000,
  volatility: 0.01,
  priceDrift: 0.0004,
};

const defaultOkxConfig: OkxExchangeConfig = {
  apiKey: safeGetEnv("OKX_API_KEY"),
  apiSecret: safeGetEnv("OKX_API_SECRET"),
  passphrase: safeGetEnv("OKX_PASSPHRASE"),
  baseUrl: safeGetEnv("OKX_BASE_URL") ?? "https://www.okx.com",
};

export const defaultConfig: AppConfig = {
  mode: modeFromEnv(),
  baseCurrency: "USDT",
  quoteCurrency: "USD",
  tradingPair: "BTC/USDT",
  startingCapital: 100_000,
  tradingFees: 0.0006,
  reportDirectory: "data/reports",
  tradeLogPath: "data/trades/trades.csv",
  exchange: {
    provider: providerFromEnv(),
    mock: defaultMockConfig,
    okx: defaultOkxConfig,
  },
  liveTrading: {
    intervalMinutes: Number(safeGetEnv("LIVE_INTERVAL_MINUTES")) || 5,
    maxIterations: safeGetEnv("LIVE_MAX_ITERATIONS")
      ? Number(safeGetEnv("LIVE_MAX_ITERATIONS"))
      : undefined,
    stopOnError: safeGetEnv("LIVE_STOP_ON_ERROR") === "true",
    reconnectAttempts: Number(safeGetEnv("LIVE_RECONNECT_ATTEMPTS")) || 3,
    reconnectDelaySeconds: Number(safeGetEnv("LIVE_RECONNECT_DELAY")) || 5,
  },
  backtest: {
    iterations: Number(safeGetEnv("BACKTEST_ITERATIONS")) || 120,
  },
  strategies: [
    {
      type: "aggressive",
      allocation: 0.4,
      maxDrawdown: 0.15,
      dailyLossLimit: 0.05,
      riskBudget: 0.08,
      targetDailyReturn: 0.018,
    },
    {
      type: "balanced",
      allocation: 0.3,
      maxDrawdown: 0.12,
      dailyLossLimit: 0.04,
      riskBudget: 0.05,
      targetDailyReturn: 0.01,
    },
    {
      type: "conservative",
      allocation: 0.3,
      maxDrawdown: 0.08,
      dailyLossLimit: 0.03,
      riskBudget: 0.03,
      targetDailyReturn: 0.005,
    },
  ],
};
