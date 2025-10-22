import { AppConfig } from "../config/config.ts";
import { ExchangeClient } from "./exchange.ts";
import { MockExchange } from "./mock_exchange.ts";
import { OkxExchange } from "./okx_exchange.ts";

export function createExchange(config: AppConfig): ExchangeClient {
  if (config.exchange.provider === "okx") {
    return new OkxExchange({
      apiKey: config.exchange.okx?.apiKey,
      apiSecret: config.exchange.okx?.apiSecret,
      passphrase: config.exchange.okx?.passphrase,
      baseUrl: config.exchange.okx?.baseUrl,
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
