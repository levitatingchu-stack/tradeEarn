import { StrategyType } from "../types.ts";
import { safeGetEnv } from "../utils/env.ts";

export type ExchangeProvider = "mock" | "kraken";

export interface MockExchangeConfig {
  initialPrice: number;
  volatility: number;
  priceDrift: number;
}

export interface KrakenExchangeConfig {
  apiKey?: string;
  apiSecret?: string;
  baseUrl: string;
}

export interface ExchangeConfig {
  provider: ExchangeProvider;
  mock?: MockExchangeConfig;
  kraken?: KrakenExchangeConfig;
}

export interface StrategyConfig {
  type: StrategyType;
  allocation: number;
  maxDrawdown: number;
  dailyLossLimit: number;
  riskBudget: number;
  targetDailyReturn: number;
}

export interface AppConfig {
  baseCurrency: string;
  quoteCurrency: string;
  tradingPair: string;
  startingCapital: number;
  strategies: StrategyConfig[];
  tradingFees: number;
  reportDirectory: string;
  tradeLogPath: string;
  exchange: ExchangeConfig;
}

const providerFromEnv = (): ExchangeProvider => {
  const value = safeGetEnv("EXCHANGE_PROVIDER")?.toLowerCase();
  if (value === "kraken") {
    return "kraken";
  }
  return "mock";
};

const defaultMockConfig: MockExchangeConfig = {
  initialPrice: 28_000,
  volatility: 0.01,
  priceDrift: 0.0004,
};

const defaultKrakenConfig: KrakenExchangeConfig = {
  apiKey: safeGetEnv("KRAKEN_API_KEY"),
  apiSecret: safeGetEnv("KRAKEN_API_SECRET"),
  baseUrl: safeGetEnv("KRAKEN_BASE_URL") ?? "https://api.kraken.com",
};

export const defaultConfig: AppConfig = {
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
    kraken: defaultKrakenConfig,
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
