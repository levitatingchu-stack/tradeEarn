import { ExchangeClient, OrderRequest, OrderResult } from "./exchange.ts";
import { MarketTick, TradeRecord } from "../types.ts";

interface OkxExchangeOptions {
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
  baseUrl?: string;
}

const DEFAULT_BASE_URL = "https://www.okx.com";

export function toOkxInstrument(symbol: string): string {
  const cleaned = symbol.replace(/\s+/g, "");
  const [base, quote] = cleaned.toUpperCase().split("/");
  if (!quote) {
    throw new Error(`Invalid trading pair: ${symbol}`);
  }
  return `${base}-${quote}`;
}

export class OkxExchange implements ExchangeClient {
  #apiKey?: string;
  #apiSecret?: string;
  #passphrase?: string;
  #baseUrl: string;
  #lastTick?: MarketTick;

  constructor(options: OkxExchangeOptions = {}) {
    this.#apiKey = options.apiKey;
    this.#apiSecret = options.apiSecret;
    this.#passphrase = options.passphrase;
    this.#baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  }

  async getLatestTick(symbol: string): Promise<MarketTick> {
    const instId = toOkxInstrument(symbol);
    const response = await fetch(`${this.#baseUrl}/api/v5/market/ticker?instId=${instId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch OKX ticker: ${response.status} ${response.statusText}`);
    }
    const payload = await response.json();
    if (payload.code !== "0") {
      throw new Error(`OKX ticker error: ${payload.msg ?? payload.code}`);
    }
    const ticker = payload.data?.[0];
    if (!ticker) {
      throw new Error(`OKX ticker response missing data for ${symbol}`);
    }
    const price = parseFloat(ticker.last);
    const volume = parseFloat(ticker.vol24h ?? ticker.volCcy24h ?? "0");
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
    if (!this.#apiKey || !this.#apiSecret || !this.#passphrase) {
      throw new Error("OKX API credentials are required to place orders.");
    }
    const path = "/api/v5/trade/order";
    const instId = toOkxInstrument(order.symbol);
    const ordType = order.price ? "limit" : "market";
    const body: Record<string, unknown> = {
      instId,
      tdMode: "cash",
      side: order.side.toLowerCase(),
      ordType,
      sz: order.size.toString(),
    };
    if (order.price) {
      body.px = order.price.toString();
    }
    if (ordType === "market" && order.side === "BUY") {
      body.tgtCcy = "base_ccy";
    }
    if (order.stopLoss) {
      body.slTriggerPx = order.stopLoss.toString();
      body.slOrdPx = order.stopLoss.toString();
    }
    if (order.takeProfit) {
      body.tpTriggerPx = order.takeProfit.toString();
      body.tpOrdPx = order.takeProfit.toString();
    }

    const response = await this.#privateRequest("POST", path, body);
    if (response.code !== "0") {
      throw new Error(`OKX order error: ${response.msg ?? response.code}`);
    }
    const orderData = response.data?.[0] ?? {};
    const filledRaw = orderData.accFillSz ?? orderData.sz ?? order.size;
    const priceRaw = orderData.avgPx ?? order.price ?? this.#lastTick?.price ?? 0;
    const feeRaw = orderData.fee ?? "0";
    const filledSize = typeof filledRaw === "string" ? parseFloat(filledRaw) : Number(filledRaw);
    const averagePrice = typeof priceRaw === "string" ? parseFloat(priceRaw) : Number(priceRaw);
    const feesPaid = typeof feeRaw === "string" ? parseFloat(feeRaw) : Number(feeRaw);
    const timestamp = new Date();
    return {
      id: orderData.ordId ?? orderData.clOrdId ?? crypto.randomUUID(),
      filledSize: Number.isFinite(filledSize) ? filledSize : order.size,
      averagePrice: Number.isFinite(averagePrice) ? averagePrice : order.price ?? this.#lastTick?.price ?? 0,
      feesPaid: Number.isFinite(feesPaid) ? feesPaid : 0,
      timestamp,
    };
  }

  getTradeHistory(): TradeRecord[] {
    return [];
  }

  async #privateRequest(method: string, path: string, body?: Record<string, unknown>): Promise<any> {
    const timestamp = new Date().toISOString();
    const bodyText = body ? JSON.stringify(body) : "";
    const signature = await this.#sign(timestamp, method, path, bodyText);
    const response = await fetch(`${this.#baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "OK-ACCESS-KEY": this.#apiKey!,
        "OK-ACCESS-SIGN": signature,
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": this.#passphrase!,
      },
      body: bodyText,
    });
    if (!response.ok) {
      throw new Error(`OKX private request failed: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async #sign(timestamp: string, method: string, path: string, body: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(this.#apiSecret!),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const payload = encoder.encode(`${timestamp}${method.toUpperCase()}${path}${body}`);
    const signature = await crypto.subtle.sign("HMAC", key, payload);
    return this.#toBase64(new Uint8Array(signature));
  }

  #toBase64(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
}
