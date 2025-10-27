import { MarketTick, TradeRecord } from "../types.ts";

export interface OrderRequest {
  symbol: string;
  side: "BUY" | "SELL";
  size: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface OrderResult {
  id: string;
  filledSize: number;
  averagePrice: number;
  feesPaid: number;
  timestamp: Date;
}

export interface ExchangeClient {
  getLatestTick(symbol: string): Promise<MarketTick>;
  placeOrder(order: OrderRequest): Promise<OrderResult>;
  currentPrice(symbol: string): number;
  getTradeHistory(): TradeRecord[];
  validateCredentials?(): Promise<{ valid: boolean; error?: string }>;
  hasCredentials?(): boolean;
}
