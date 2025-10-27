import { ensureDir } from "https://deno.land/std@0.214.0/fs/ensure_dir.ts";
import { dirname } from "https://deno.land/std@0.214.0/path/dirname.ts";
import { MarketTick, TradeRecord } from "../types.ts";
import { ExchangeClient, OrderRequest, OrderResult } from "./exchange.ts";

interface MockExchangeOptions {
  symbol: string;
  initialPrice: number;
  volatility: number;
  priceDrift?: number;
  logPath?: string;
}

export class MockExchange implements ExchangeClient {
  #symbol: string;
  #price: number;
  #volatility: number;
  #priceDrift: number;
  #history: TradeRecord[] = [];
  #logPath?: string;

  constructor(options: MockExchangeOptions) {
    this.#symbol = options.symbol;
    this.#price = options.initialPrice;
    this.#volatility = options.volatility;
    this.#priceDrift = options.priceDrift ?? 0;
    this.#logPath = options.logPath;
  }

  async getLatestTick(symbol: string): Promise<MarketTick> {
    await Promise.resolve(); // Keep async for interface compatibility
    if (symbol !== this.#symbol) {
      throw new Error(`Unsupported symbol ${symbol}`);
    }
    this.#simulatePriceMove();
    return {
      symbol: this.#symbol,
      price: this.#price,
      volume: 100 + Math.random() * 50,
      timestamp: new Date(),
    };
  }

  currentPrice(symbol: string): number {
    if (symbol !== this.#symbol) {
      throw new Error(`Unsupported symbol ${symbol}`);
    }
    return this.#price;
  }

  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    if (order.symbol !== this.#symbol) {
      throw new Error(`Unsupported symbol ${order.symbol}`);
    }
    const price = this.#price;
    const timestamp = new Date();
    const fees = Math.abs(order.size) * price * 0.0006;
    const record: TradeRecord = {
      strategy: "aggressive", // placeholder; overwritten by caller when recording
      timestamp,
      action: order.side,
      price,
      size: order.size,
      fees,
      reason: "",
      confidence: 0,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
    };
    this.#history.push(record);
    if (this.#logPath) {
      await this.#appendToLog(record);
    }
    return {
      id: crypto.randomUUID(),
      filledSize: order.size,
      averagePrice: price,
      feesPaid: fees,
      timestamp,
    };
  }

  getTradeHistory(): TradeRecord[] {
    return this.#history;
  }

  async validateCredentials(): Promise<{ valid: boolean; error?: string }> {
    // Mock exchange doesn't need credentials
    await Promise.resolve(); // Keep async for interface compatibility
    return { valid: true };
  }

  hasCredentials(): boolean {
    // Mock exchange doesn't need credentials
    return true;
  }

  #simulatePriceMove() {
    const randomShock = (Math.random() - 0.5) * this.#volatility;
    this.#price = Math.max(1, this.#price * (1 + randomShock + this.#priceDrift));
  }

  async #appendToLog(record: TradeRecord) {
    if (!this.#logPath) return;
    await ensureDir(dirname(this.#logPath));
    const header =
      "strategy,timestamp,action,price,size,fees,reason,confidence,stopLoss,takeProfit";
    const line = [
      record.strategy,
      record.timestamp.toISOString(),
      record.action,
      record.price.toFixed(2),
      record.size.toFixed(6),
      record.fees.toFixed(2),
      record.reason.replace(/,/g, " "),
      record.confidence.toFixed(3),
      record.stopLoss ?? "",
      record.takeProfit ?? "",
    ].join(",") + "\n";
    try {
      await Deno.stat(this.#logPath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        await Deno.writeTextFile(this.#logPath, `${header}\n`, { append: false });
      } else {
        throw error;
      }
    }
    await Deno.writeTextFile(this.#logPath, line, { append: true });
  }
}
