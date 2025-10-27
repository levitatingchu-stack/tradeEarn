import { ensureDir } from "https://deno.land/std@0.214.0/fs/ensure_dir.ts";
import { dirname, join } from "https://deno.land/std@0.214.0/path/mod.ts";
import { defaultConfig } from "./config/config.ts";
import { MarketDataService } from "./data/market_data_service.ts";
import { StaticSentimentProvider, SentimentDataService } from "./data/sentiment_data_service.ts";
import { RiskManager } from "./risk/risk_manager.ts";
import { Backtester, BacktestResult } from "./backtest/backtester.ts";
import { Reporter } from "./reports/reporter.ts";
import { createExchange } from "./exchanges/exchange_factory.ts";

async function main() {
  const config = defaultConfig;
  const exchange = createExchange(config);
  console.log(`Using ${config.exchange.provider} exchange provider for ${config.tradingPair}.`);
  const marketData = new MarketDataService(exchange);
  const sentimentService = new SentimentDataService(new StaticSentimentProvider(0.1));
  const riskManager = new RiskManager();
  const backtester = new Backtester(
    marketData,
    sentimentService,
    riskManager,
    config.strategies,
    config.startingCapital,
    config.tradingPair,
    config.tradingFees,
  );

  const result = await backtester.run(120);
  await saveTrades(result);
  await saveReport(result);
  console.log(`Completed simulation with ${result.trades.length} trades.`);
}

async function saveTrades(result: BacktestResult) {
  const config = defaultConfig;
  const header = "strategy,timestamp,action,price,size,fees,reason,confidence,stopLoss,takeProfit";
  const lines = result.trades.map((trade) => [
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
  ].join(","));
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
}

if (import.meta.main) {
  await main();
}
