import { ensureDir } from "https://deno.land/std@0.214.0/fs/ensure_dir.ts";
import { dirname, join } from "https://deno.land/std@0.214.0/path/mod.ts";
import { defaultConfig } from "./config/config.ts";
import { MarketDataService } from "./data/market_data_service.ts";
import { SentimentDataService, StaticSentimentProvider } from "./data/sentiment_data_service.ts";
import { RiskManager } from "./risk/risk_manager.ts";
import { Backtester, BacktestResult } from "./backtest/backtester.ts";
import { LiveTrader } from "./live/live_trader.ts";
import { Reporter } from "./reports/reporter.ts";
import { createExchange } from "./exchanges/exchange_factory.ts";

async function main() {
  const config = defaultConfig;
  const exchange = createExchange(config);

  console.log("🤖 TradeEarn Trading Bot");
  console.log("═".repeat(60));
  console.log(`📊 Mode: ${config.mode.toUpperCase()}`);
  console.log(`🔗 Exchange: ${config.exchange.provider.toUpperCase()}`);
  console.log(`💱 Trading Pair: ${config.tradingPair}`);
  console.log("═".repeat(60));

  const marketData = new MarketDataService(exchange);
  const sentimentService = new SentimentDataService(new StaticSentimentProvider(0.1));
  const riskManager = new RiskManager();

  if (config.mode === "live") {
    await runLiveTrading(config, marketData, sentimentService, riskManager);
  } else {
    await runBacktest(config, marketData, sentimentService, riskManager);
  }
}

async function runLiveTrading(
  config: typeof defaultConfig,
  marketData: MarketDataService,
  sentimentService: SentimentDataService,
  riskManager: RiskManager,
) {
  console.log("\n🚀 Starting Live Trading Mode...\n");

  // 验证交易所凭证（如果需要）
  const exchange = createExchange(config);
  if (exchange.validateCredentials && exchange.hasCredentials) {
    if (exchange.hasCredentials()) {
      console.log("🔑 Validating API credentials...");
      const validation = await exchange.validateCredentials();
      if (!validation.valid) {
        console.error("❌ API Credential Validation Failed:");
        console.error(`   ${validation.error}`);
        console.error("\n⚠️  Cannot proceed with live trading without valid credentials.");
        console.error("   The bot can read market data but cannot place orders.");
        console.error("\n💡 Options:");
        console.error("   1. Fix your API credentials and restart");
        console.error("   2. Use EXCHANGE_PROVIDER=mock for simulation");
        console.error("   3. Continue anyway (read-only mode) by pressing Enter");

        const proceed = prompt("\nProceed in read-only mode? (yes/no): ");
        if (proceed?.toLowerCase() !== "yes" && proceed?.toLowerCase() !== "y") {
          console.log("Exiting...");
          Deno.exit(1);
        }
        console.log("\n⚠️  Running in READ-ONLY mode (no trades will be executed)\n");
      } else {
        console.log("✅ API credentials validated successfully\n");
      }
    } else {
      console.log("ℹ️  No API credentials configured (read-only mode)\n");
    }
  }

  const trader = new LiveTrader(
    marketData,
    sentimentService,
    riskManager,
    config.strategies,
    config.startingCapital,
    config.tradingPair,
    config.tradingFees,
    config.liveTrading,
  );

  await trader.start();

  // Keep the process alive
  // The trader will handle its own shutdown via signal handlers
}

async function runBacktest(
  config: typeof defaultConfig,
  marketData: MarketDataService,
  sentimentService: SentimentDataService,
  riskManager: RiskManager,
) {
  console.log("\n📊 Starting Backtest Mode...\n");

  const backtester = new Backtester(
    marketData,
    sentimentService,
    riskManager,
    config.strategies,
    config.startingCapital,
    config.tradingPair,
    config.tradingFees,
  );

  const result = await backtester.run(config.backtest.iterations);
  await saveTrades(result);
  await saveReport(result);

  console.log("\n✅ Backtest completed!");
  console.log(`📈 Total trades: ${result.trades.length}`);
  console.log(`📊 Equity curve points: ${result.equityCurve.length}`);
}

async function saveTrades(result: BacktestResult) {
  const config = defaultConfig;
  const header = "strategy,timestamp,action,price,size,fees,reason,confidence,stopLoss,takeProfit";
  const lines = result.trades.map((trade) =>
    [
      trade.strategy,
      trade.timestamp.toISOString(),
      trade.action,
      trade.price.toFixed(2),
      trade.size.toFixed(6),
      trade.fees.toFixed(2),
      trade.reason.replace(/,/g, " "),
      trade.confidence.toFixed(3),
      trade.stopLoss ?? "",
      trade.takeProfit ?? "",
    ].join(",")
  );
  await ensureDir(dirname(config.tradeLogPath));
  const csv = [header, ...lines].join("\n");
  await Deno.writeTextFile(config.tradeLogPath, csv + "\n");
}

async function saveReport(result: BacktestResult) {
  const reporter = new Reporter();
  const performance = reporter.buildDailyPerformance(result.equityCurve, result.trades);
  const markdown = reporter.renderMarkdown(performance);
  await ensureDir(defaultConfig.reportDirectory);
  const reportPath = join(defaultConfig.reportDirectory, `performance-${Date.now()}.md`);
  await Deno.writeTextFile(reportPath, markdown + "\n");
  console.log(`📄 Report saved: ${reportPath}`);
}

if (import.meta.main) {
  await main();
}
