import { MarketDataService } from "../data/market_data_service.ts";
import { SentimentDataService } from "../data/sentiment_data_service.ts";
import { RiskManager } from "../risk/risk_manager.ts";
import { StrategyConfig } from "../config/config.ts";
import {
  AccountSnapshot,
  StrategyContext,
  StrategyRuntimeConfig,
  StrategyType,
  TradeRecord,
} from "../types.ts";
import { AggressiveStrategy } from "../strategies/aggressive.ts";
import { BalancedStrategy } from "../strategies/balanced.ts";
import { ConservativeStrategy } from "../strategies/conservative.ts";
import { BaseStrategy } from "../strategies/base_strategy.ts";
import { Portfolio } from "../backtest/portfolio.ts";
import { EnforcedDecision } from "../risk/risk_manager.ts";

interface StrategyBundle {
  config: StrategyConfig;
  engine: BaseStrategy;
  portfolio: Portfolio;
}

export interface LiveTraderConfig {
  intervalMinutes: number; // 执行间隔（分钟）
  maxIterations?: number; // 最大迭代次数（可选，不设置则无限运行）
  stopOnError: boolean; // 遇到错误是否停止
  reconnectAttempts: number; // 重连尝试次数
  reconnectDelaySeconds: number; // 重连延迟（秒）
}

export interface LiveTraderStats {
  startTime: Date;
  iterations: number;
  totalTrades: number;
  lastPrice?: number;
  lastUpdate?: Date;
  errors: number;
}

export class LiveTrader {
  #strategies: StrategyBundle[] = [];
  #trades: TradeRecord[] = [];
  #equityCurve: AccountSnapshot[] = [];
  #running = false;
  #intervalId?: number;
  #stats: LiveTraderStats;
  #abortController: AbortController;

  constructor(
    private readonly marketData: MarketDataService,
    private readonly sentimentData: SentimentDataService,
    private readonly riskManager: RiskManager,
    configs: StrategyConfig[],
    startingCapital: number,
    private readonly tradingPair: string,
    private readonly tradingFees: number,
    private readonly config: LiveTraderConfig,
  ) {
    for (const strategyConfig of configs) {
      const engine = this.#createStrategy(strategyConfig.type);
      const portfolio = new Portfolio(
        strategyConfig.type,
        startingCapital * strategyConfig.allocation,
        tradingPair,
      );
      this.#strategies.push({ config: strategyConfig, engine, portfolio });
    }

    this.#stats = {
      startTime: new Date(),
      iterations: 0,
      totalTrades: 0,
      errors: 0,
    };

    this.#abortController = new AbortController();
  }

  async start(): Promise<void> {
    if (this.#running) {
      console.warn("⚠️  LiveTrader is already running");
      return;
    }

    this.#running = true;
    this.#stats.startTime = new Date();

    console.log("🚀 Starting Live Trader...");
    console.log(`📊 Trading Pair: ${this.tradingPair}`);
    console.log(`⏱️  Interval: ${this.config.intervalMinutes} minute(s)`);
    console.log(
      `🔄 Max Iterations: ${this.config.maxIterations ?? "Unlimited"}`,
    );
    console.log(`💰 Starting Capital: $${this.#getTotalEquity().toFixed(2)}`);
    console.log("─".repeat(60));

    // 设置信号处理（Ctrl+C 优雅退出）
    this.#setupSignalHandlers();

    // 立即执行第一次
    await this.#executeTradingCycle();

    // 设置定时器
    this.#intervalId = setInterval(
      () => this.#executeTradingCycle(),
      this.config.intervalMinutes * 60 * 1000,
    );
  }

  stop(): void {
    if (!this.#running) {
      return;
    }

    console.log("\n⏹️  Stopping Live Trader...");
    this.#running = false;

    if (this.#intervalId !== undefined) {
      clearInterval(this.#intervalId);
      this.#intervalId = undefined;
    }

    this.#abortController.abort();
    this.#printFinalStats();
  }

  isRunning(): boolean {
    return this.#running;
  }

  getStats(): LiveTraderStats {
    return { ...this.#stats };
  }

  getTrades(): TradeRecord[] {
    return [...this.#trades];
  }

  getEquityCurve(): AccountSnapshot[] {
    return [...this.#equityCurve];
  }

  async #executeTradingCycle(): Promise<void> {
    if (!this.#running) {
      return;
    }

    // 检查是否达到最大迭代次数
    if (
      this.config.maxIterations !== undefined &&
      this.#stats.iterations >= this.config.maxIterations
    ) {
      console.log(
        `✅ Reached maximum iterations (${this.config.maxIterations})`,
      );
      this.stop();
      return;
    }

    const cycleStart = Date.now();
    let attempts = 0;

    while (attempts < this.config.reconnectAttempts) {
      try {
        // 获取最新行情
        const tick = await this.marketData.latest(this.tradingPair);

        this.#stats.lastPrice = tick.price;
        this.#stats.lastUpdate = tick.timestamp;

        console.log(
          `\n[${tick.timestamp.toISOString()}] 📈 ${this.tradingPair}: $${tick.price.toFixed(2)}`,
        );

        // 处理每个策略
        for (const bundle of this.#strategies) {
          await this.#processStrategyStep(bundle, tick);
        }

        this.#stats.iterations++;

        // 显示当前状态
        this.#printStatus();

        // 成功执行，退出重试循环
        break;
      } catch (error) {
        attempts++;
        this.#stats.errors++;

        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `❌ Error in trading cycle (attempt ${attempts}/${this.config.reconnectAttempts}):`,
          errorMsg,
        );

        if (attempts >= this.config.reconnectAttempts) {
          if (this.config.stopOnError) {
            console.error("🛑 Maximum reconnect attempts reached. Stopping...");
            this.stop();
            return;
          } else {
            console.warn("⚠️  Maximum reconnect attempts reached. Continuing...");
            break;
          }
        }

        // 等待后重试
        await this.#delay(this.config.reconnectDelaySeconds * 1000);
      }
    }

    const cycleDuration = Date.now() - cycleStart;
    if (cycleDuration > 5000) {
      console.log(
        `⏱️  Cycle took ${(cycleDuration / 1000).toFixed(1)}s`,
      );
    }
  }

  async #processStrategyStep(
    bundle: StrategyBundle,
    tick: { price: number; timestamp: Date },
  ): Promise<void> {
    try {
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
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        `❌ Error processing strategy ${bundle.config.type}:`,
        errorMsg,
      );
      throw error;
    }
  }

  #executeDecision(
    bundle: StrategyBundle,
    decision: EnforcedDecision,
    price: number,
    originalDecision: {
      reason: string;
      confidence: number;
      stopLoss?: number;
      takeProfit?: number;
    },
  ): void {
    if (decision.action === "HOLD" || decision.size <= 0) {
      if (decision.reason && decision.reason !== "Conditions not met") {
        console.log(
          `   ${bundle.config.type}: ${decision.action} - ${decision.reason}`,
        );
      }
      return;
    }

    const fees = decision.size * price * this.tradingFees;
    let realizedPnl = 0;

    if (decision.action === "BUY") {
      bundle.portfolio.buy(decision.size, price, fees);
      console.log(
        `   🟢 ${bundle.config.type}: BUY ${decision.size.toFixed(6)} @ $${
          price.toFixed(2)
        } (${originalDecision.reason})`,
      );
    } else {
      realizedPnl = bundle.portfolio.sell(decision.size, price, fees);
      console.log(
        `   🔴 ${bundle.config.type}: SELL ${decision.size.toFixed(6)} @ $${
          price.toFixed(2)
        } (${originalDecision.reason}) PnL: $${realizedPnl.toFixed(2)}`,
      );
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
    this.#stats.totalTrades++;

    const peak = bundle.portfolio.peakEquity();
    const equity = bundle.portfolio.equity(price);
    this.riskManager.updatePerformance(bundle.config.type, realizedPnl, peak, equity);
  }

  #captureSnapshot(bundle: StrategyBundle, price: number, timestamp: Date): void {
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

  #getTotalEquity(): number {
    const currentPrice = this.#stats.lastPrice ?? 0;
    return this.#strategies.reduce(
      (sum, bundle) => sum + bundle.portfolio.equity(currentPrice),
      0,
    );
  }

  #printStatus(): void {
    const totalEquity = this.#getTotalEquity();

    console.log(`   💼 Total Equity: $${totalEquity.toFixed(2)}`);
    console.log(`   📊 Total Trades: ${this.#stats.totalTrades}`);
    console.log(`   🔄 Iterations: ${this.#stats.iterations}`);

    // 显示每个策略的持仓
    for (const bundle of this.#strategies) {
      const holding = this.#holdingAmount(bundle);
      if (holding > 0) {
        const value = holding * (this.#stats.lastPrice ?? 0);
        console.log(
          `   📦 ${bundle.config.type}: ${holding.toFixed(6)} BTC ($${value.toFixed(2)})`,
        );
      }
    }
  }

  #printFinalStats(): void {
    const duration = Date.now() - this.#stats.startTime.getTime();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

    console.log("\n" + "═".repeat(60));
    console.log("📊 Live Trading Session Summary");
    console.log("═".repeat(60));
    console.log(`⏱️  Duration: ${hours}h ${minutes}m`);
    console.log(`🔄 Total Iterations: ${this.#stats.iterations}`);
    console.log(`📈 Total Trades: ${this.#stats.totalTrades}`);
    console.log(`❌ Errors: ${this.#stats.errors}`);
    console.log(`💼 Final Equity: $${this.#getTotalEquity().toFixed(2)}`);

    if (this.#stats.lastPrice) {
      console.log(`📊 Last Price: $${this.#stats.lastPrice.toFixed(2)}`);
    }

    console.log("═".repeat(60));
  }

  #setupSignalHandlers(): void {
    const signals: Deno.Signal[] = ["SIGINT", "SIGTERM"];

    for (const signal of signals) {
      Deno.addSignalListener(signal, () => {
        console.log(`\n\n📡 Received ${signal} signal`);
        this.stop();
        Deno.exit(0);
      });
    }
  }

  #delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
