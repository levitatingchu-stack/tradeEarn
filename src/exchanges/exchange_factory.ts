import { AppConfig } from "../config/config.ts";
import { ExchangeClient } from "./exchange.ts";
import { MockExchange } from "./mock_exchange.ts";
import { KrakenExchange } from "./kraken_exchange.ts";

export function createExchange(config: AppConfig): ExchangeClient {
  if (config.exchange.provider === "kraken") {
    return new KrakenExchange({
      apiKey: config.exchange.kraken?.apiKey,
      apiSecret: config.exchange.kraken?.apiSecret,
      baseUrl: config.exchange.kraken?.baseUrl,
    });
  }
  const mock = config.exchange.mock;
  return new MockExchange({
    symbol: config.tradingPair,
    initialPrice: mock?.initialPrice ?? 28_000,
    volatility: mock?.volatility ?? 0.01,
    priceDrift: mock?.priceDrift ?? 0.0004,
    logPath: config.tradeLogPath,
  });
}
