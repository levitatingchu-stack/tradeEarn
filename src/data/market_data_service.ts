import { ExchangeClient } from "../exchanges/exchange.ts";
import { MarketTick } from "../types.ts";

export class MarketDataService {
  constructor(private readonly exchange: ExchangeClient) {}

  async latest(symbol: string): Promise<MarketTick> {
    return await this.exchange.getLatestTick(symbol);
  }
}
