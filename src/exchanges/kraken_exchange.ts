import { ExchangeClient, OrderRequest, OrderResult } from "./exchange.ts";
import { MarketTick, TradeRecord } from "../types.ts";

interface KrakenExchangeOptions {
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
}

const DEFAULT_BASE_URL = "https://api.kraken.com";

export function toKrakenPair(symbol: string): string {
  const cleaned = symbol.replace(/\s+/g, "");
  const [rawBase, rawQuote] = cleaned.toUpperCase().split("/");
  if (!rawQuote) {
    throw new Error(`Invalid trading pair: ${symbol}`);
  }
  const base = assetOverrides[rawBase] ?? rawBase;
  const quote = assetOverrides[rawQuote] ?? rawQuote;
  return `${base}${quote}`;
}

const assetOverrides: Record<string, string> = {
  BTC: "XBT",
  XBT: "XBT",
  ETH: "ETH",
  LTC: "LTC",
  SOL: "SOL",
  ADA: "ADA",
  DOT: "DOT",
  DOGE: "DOGE",
  XRP: "XRP",
  USD: "USD",
  USDT: "USDT",
  EUR: "EUR",
  GBP: "GBP",
  JPY: "JPY",
  AUD: "AUD",
};

export class KrakenExchange implements ExchangeClient {
  #apiKey?: string;
  #apiSecret?: string;
  #baseUrl: string;
  #lastTick?: MarketTick;

  constructor(options: KrakenExchangeOptions = {}) {
    this.#apiKey = options.apiKey;
    this.#apiSecret = options.apiSecret;
    this.#baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  }

  async getLatestTick(symbol: string): Promise<MarketTick> {
    const pair = toKrakenPair(symbol);
    const response = await fetch(`${this.#baseUrl}/0/public/Ticker?pair=${pair}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Kraken ticker: ${response.status} ${response.statusText}`);
    }
    const payload = await response.json();
    if (Array.isArray(payload.error) && payload.error.length > 0) {
      throw new Error(`Kraken ticker error: ${payload.error.join(",")}`);
    }
    const [resultKey] = Object.keys(payload.result ?? {});
    if (!resultKey) {
      throw new Error(`Kraken ticker response missing result for ${symbol}`);
    }
    const ticker = payload.result[resultKey];
    const price = parseFloat(ticker.c[0]);
    const volume = parseFloat(ticker.v?.[1] ?? ticker.v?.[0] ?? "0");
    const tick: MarketTick = {
      symbol,
      price,
      volume: Number.isFinite(volume) ? volume : 0,
      timestamp: new Date(),
    };
    this.#lastTick = tick;
    return tick;
  }

  currentPrice(symbol: string): number {
    if (!this.#lastTick || this.#lastTick.symbol !== symbol) {
      throw new Error(`Price for ${symbol} not cached. Call getLatestTick first.`);
    }
    return this.#lastTick.price;
  }

  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    if (!this.#apiKey || !this.#apiSecret) {
      throw new Error("Kraken API credentials are required to place orders.");
    }
    const path = "/0/private/AddOrder";
    const params = new URLSearchParams({
      pair: toKrakenPair(order.symbol),
      type: order.side.toLowerCase(),
      ordertype: order.price ? "limit" : "market",
      volume: order.size.toString(),
    });
    if (order.price) {
      params.set("price", order.price.toString());
    }
    if (order.stopLoss && order.takeProfit) {
      params.set("close[ordertype]", "stop-loss-profit");
      params.set("close[price]", order.stopLoss.toString());
      params.set("close[price2]", order.takeProfit.toString());
    } else if (order.stopLoss) {
      params.set("close[ordertype]", "stop-loss");
      params.set("close[price]", order.stopLoss.toString());
    } else if (order.takeProfit) {
      params.set("close[ordertype]", "take-profit");
      params.set("close[price]", order.takeProfit.toString());
    }

    const response = await this.#privateRequest(path, params);
    if (Array.isArray(response.error) && response.error.length > 0) {
      throw new Error(`Kraken order error: ${response.error.join(",")}`);
    }
    const txid = response.result?.txid?.[0] ?? crypto.randomUUID();
    const averagePrice = order.price ?? this.#lastTick?.price ?? 0;
    const timestamp = new Date();
    return {
      id: txid,
      filledSize: order.size,
      averagePrice,
      feesPaid: 0,
      timestamp,
    };
  }

  getTradeHistory(): TradeRecord[] {
    return [];
  }

  async #privateRequest(path: string, params: URLSearchParams): Promise<any> {
    const nonce = this.#nonce();
    params.set("nonce", nonce);
    const body = params.toString();
    const signature = await this.#sign(path, nonce, body);
    const response = await fetch(`${this.#baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        "API-Key": this.#apiKey!,
        "API-Sign": signature,
      },
      body,
    });
    if (!response.ok) {
      throw new Error(`Kraken private request failed: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  #nonce(): string {
    return `${Date.now()}${Math.floor(Math.random() * 1_000)}`;
  }

  async #sign(path: string, nonce: string, body: string): Promise<string> {
    const encoder = new TextEncoder();
    const message = encoder.encode(nonce + body);
    const hashBuffer = await crypto.subtle.digest("SHA-256", message);
    const pathBytes = encoder.encode(path);
    const toSign = new Uint8Array(pathBytes.length + hashBuffer.byteLength);
    toSign.set(pathBytes, 0);
    toSign.set(new Uint8Array(hashBuffer), pathBytes.length);
    const key = await crypto.subtle.importKey(
      "raw",
      this.#decodeBase64(this.#apiSecret!),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, toSign);
    return this.#encodeBase64(new Uint8Array(signature));
  }

  #decodeBase64(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  #encodeBase64(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
}
