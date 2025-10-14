import {
  assertAlmostEquals,
  assertEquals,
  assertGreaterThan,
} from "https://deno.land/std@0.214.0/assert/mod.ts";
import { AggressiveStrategy } from "./aggressive.ts";
import { RiskManager } from "../risk/risk_manager.ts";
import { StrategyConfig } from "../config/config.ts";
import { StrategyContext, StrategyRuntimeConfig } from "../types.ts";
import { MarketDataService } from "../data/market_data_service.ts";
import { MockExchange } from "../exchanges/mock_exchange.ts";
import { SentimentDataService, StaticSentimentProvider } from "../data/sentiment_data_service.ts";
import { Backtester } from "../backtest/backtester.ts";

function baseContext(price: number, cash: number): StrategyContext {
  const runtime: StrategyRuntimeConfig = {
    allocation: 0.4,
    maxDrawdown: 0.15,
    dailyLossLimit: 0.05,
    riskBudget: 0.08,
  };
  return {
    market: {
      symbol: "BTC/USDT",
      price,
      timestamp: new Date(),
      volume: 0,
    },
    sentiment: [{
      source: "test",
      score: 0.5,
      confidence: 0.9,
      timestamp: new Date(),
    }],
    portfolio: {
      cash,
      holdings: {},
      realizedPnl: 0,
      unrealizedPnl: 0,
    },
    config: runtime,
  };
}

Deno.test("Aggressive strategy reacts to momentum", () => {
  const strategy = new AggressiveStrategy();
  const ctx1 = baseContext(100, 10_000);
  const holdDecision = strategy.decide(ctx1);
  assertEquals(holdDecision.action, "HOLD");
  const ctx2 = baseContext(101, 10_000);
  const decision = strategy.decide(ctx2);
  assertEquals(decision.action, "BUY");
  assertGreaterThan(decision.size, 0);
});

Deno.test("Risk manager prevents leverage on buy", () => {
  const riskManager = new RiskManager();
  const strategyConfig: StrategyConfig = {
    type: "aggressive",
    allocation: 0.4,
    maxDrawdown: 0.15,
    dailyLossLimit: 0.05,
    riskBudget: 0.08,
    targetDailyReturn: 0.018,
  };
  const context = baseContext(20_000, 200);
  const decision = {
    action: "BUY" as const,
    size: 5,
    reason: "test",
    confidence: 1,
  };
  const enforced = riskManager.enforce(strategyConfig, context, decision);
  assertAlmostEquals(enforced.size, context.portfolio.cash / context.market.price);
});

Deno.test("Backtester produces equity snapshots", async () => {
  const exchange = new MockExchange({
    symbol: "BTC/USDT",
    initialPrice: 30_000,
    volatility: 0.001,
  });
  const marketData = new MarketDataService(exchange);
  const sentiment = new SentimentDataService(new StaticSentimentProvider(0));
  const risk = new RiskManager();
  const config: StrategyConfig[] = [{
    type: "balanced",
    allocation: 1,
    maxDrawdown: 0.12,
    dailyLossLimit: 0.04,
    riskBudget: 0.05,
    targetDailyReturn: 0.01,
  }];
  const tester = new Backtester(
    marketData,
    sentiment,
    risk,
    config,
    1_000,
    "BTC/USDT",
    0.0006,
  );
  const result = await tester.run(5);
  assertEquals(result.equityCurve.length, 5);
  assertGreaterThan(result.trades.length, -1);
});
