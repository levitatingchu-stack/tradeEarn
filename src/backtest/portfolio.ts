import { PortfolioState, TradeRecord, StrategyType } from "../types.ts";

export class Portfolio {
  readonly state: PortfolioState;
  #tradeLog: TradeRecord[] = [];
  #peakEquity: number;

  constructor(
    readonly strategy: StrategyType,
    cash: number,
    readonly symbol: string,
  ) {
    this.state = {
      cash,
      holdings: {},
      realizedPnl: 0,
      unrealizedPnl: 0,
    };
    this.#peakEquity = cash;
  }

  recordTrade(record: TradeRecord) {
    this.#tradeLog.push(record);
  }

  buy(amount: number, price: number, fees: number): number {
    if (amount <= 0) return 0;
    const cost = amount * price + fees;
    if (cost > this.state.cash) {
      throw new Error("Insufficient cash for buy operation");
    }
    this.state.cash -= cost;
    const holding = this.state.holdings[this.symbol] ?? {
      symbol: this.symbol,
      amount: 0,
      entryPrice: price,
      timestamp: new Date(),
    };
    const newAmount = holding.amount + amount;
    holding.entryPrice = (holding.entryPrice * holding.amount + price * amount) / newAmount;
    holding.amount = newAmount;
    holding.timestamp = new Date();
    this.state.holdings[this.symbol] = holding;
    this.#updatePeak(price);
    return 0;
  }

  sell(amount: number, price: number, fees: number): number {
    if (amount <= 0) return 0;
    const holding = this.state.holdings[this.symbol];
    if (!holding || holding.amount < amount) {
      throw new Error("Insufficient holdings for sell operation");
    }
    holding.amount -= amount;
    const proceeds = amount * price - fees;
    this.state.cash += proceeds;
    const pnl = (price - holding.entryPrice) * amount - fees;
    this.state.realizedPnl += pnl;
    if (holding.amount === 0) {
      delete this.state.holdings[this.symbol];
    }
    this.#updatePeak(price);
    return pnl;
  }

  equity(price: number): number {
    const holding = this.state.holdings[this.symbol];
    const holdingsValue = holding ? holding.amount * price : 0;
    this.state.unrealizedPnl = holding ? (price - holding.entryPrice) * holding.amount : 0;
    return this.state.cash + holdingsValue;
  }

  peakEquity(): number {
    return this.#peakEquity;
  }

  trades(): TradeRecord[] {
    return this.#tradeLog;
  }

  private #updatePeak(price: number) {
    const currentEquity = this.equity(price);
    this.#peakEquity = Math.max(this.#peakEquity, currentEquity);
  }
}
