import { MarketDataService } from "../data/market_data_service.ts";
import { SentimentDataService } from "../data/sentiment_data_service.ts";
import { StrategyConfig } from "../config/config.ts";
import {
  AccountSnapshot,
  StrategyContext,
  StrategyRuntimeConfig,
  StrategyType,
  TradeDecision,
  TradeRecord,
} from "../types.ts";
import { AggressiveStrategy } from "../strategies/aggressive.ts";
import { BalancedStrategy } from "../strategies/balanced.ts";
import { ConservativeStrategy } from "../strategies/conservative.ts";
import { BaseStrategy } from "../strategies/base_strategy.ts";
import { Portfolio } from "./portfolio.ts";
import { EnforcedDecision, RiskManager } from "../risk/risk_manager.ts";

interface StrategyBundle {
  config: StrategyConfig;
  engine: BaseStrategy;
  portfolio: Portfolio;
}

export interface BacktestResult {
  trades: TradeRecord[];
  equityCurve: AccountSnapshot[];
}

export class Backtester {
  #strategies: StrategyBundle[] = [];
  #equityCurve: AccountSnapshot[] = [];
  #trades: TradeRecord[] = [];

  constructor(
    private readonly marketData: MarketDataService,
    private readonly sentimentData: SentimentDataService,
    private readonly riskManager: RiskManager,
    configs: StrategyConfig[],
    startingCapital: number,
    private readonly tradingPair: string,
    private readonly tradingFees: number,
  ) {
    for (const config of configs) {
      const engine = this.#createStrategy(config.type);
      const portfolio = new Portfolio(
        config.type,
        startingCapital * config.allocation,
        tradingPair,
      );
      this.#strategies.push({ config, engine, portfolio });
    }
  }

  async run(iterations: number): Promise<BacktestResult> {
    for (let step = 0; step < iterations; step++) {
      const tick = await this.marketData.latest(this.tradingPair);
      for (const bundle of this.#strategies) {
        await this.#processStrategyStep(bundle, tick);
      }
    }
    return {
      trades: this.#trades,
      equityCurve: this.#equityCurve,
    };
  }

  async #processStrategyStep(bundle: StrategyBundle, tick: { price: number; timestamp: Date }) {
    const sentiments = await this.sentimentData.compositeScore(
      this.tradingPair,
      bundle.config.type,
    );
    const context: StrategyContext = {
      market: {
        symbol: this.tradingPair,
        price: tick.price,
        timestamp: tick.timestamp,
        volume: 0,
      },
      sentiment: sentiments,
      portfolio: bundle.portfolio.state,
      config: this.#runtimeConfig(bundle.config),
    };
    const decision = bundle.engine.decide(context);
    const enforced = this.riskManager.enforce(bundle.config, context, decision);
    this.#executeDecision(bundle, enforced, tick.price, decision);
    this.#captureSnapshot(bundle, tick.price, tick.timestamp);
  }

  #executeDecision(
    bundle: StrategyBundle,
    decision: EnforcedDecision,
    price: number,
    originalDecision: TradeDecision,
  ) {
    if (decision.action === "HOLD" || decision.size <= 0) {
      return;
    }
    const fees = decision.size * price * this.tradingFees;
    let realizedPnl = 0;
    if (decision.action === "BUY") {
      bundle.portfolio.buy(decision.size, price, fees);
    } else {
      realizedPnl = bundle.portfolio.sell(decision.size, price, fees);
    }
    const record: TradeRecord = {
      strategy: bundle.config.type,
      timestamp: new Date(),
      action: decision.action,
      price,
      size: decision.size,
      fees,
      reason: originalDecision.reason,
      confidence: originalDecision.confidence,
      stopLoss: originalDecision.stopLoss,
      takeProfit: originalDecision.takeProfit,
    };
    bundle.portfolio.recordTrade(record);
    this.#trades.push(record);
    const peak = bundle.portfolio.peakEquity();
    const equity = bundle.portfolio.equity(price);
    this.riskManager.updatePerformance(bundle.config.type, realizedPnl, peak, equity);
  }

  #captureSnapshot(bundle: StrategyBundle, price: number, timestamp: Date) {
    const equity = bundle.portfolio.equity(price);
    const exposure = this.#holdingAmount(bundle) * price;
    this.#equityCurve.push({
      strategy: bundle.config.type,
      timestamp,
      equity,
      cash: bundle.portfolio.state.cash,
      exposure,
    });
  }

  #holdingAmount(bundle: StrategyBundle): number {
    const holding = bundle.portfolio.state.holdings[this.tradingPair];
    return holding ? holding.amount : 0;
  }

  #runtimeConfig(config: StrategyConfig): StrategyRuntimeConfig {
    return {
      allocation: config.allocation,
      maxDrawdown: config.maxDrawdown,
      dailyLossLimit: config.dailyLossLimit,
      riskBudget: config.riskBudget,
    };
  }

  #createStrategy(type: StrategyType): BaseStrategy {
    switch (type) {
      case "aggressive":
        return new AggressiveStrategy();
      case "balanced":
        return new BalancedStrategy();
      case "conservative":
        return new ConservativeStrategy();
    }
  }
}
