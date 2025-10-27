import { StrategyContext, TradeDecision } from "../types.ts";

export abstract class BaseStrategy {
  #lastPrice?: number;
  #coolDownUntil?: Date;

  protected constructor(private readonly coolDownMinutes: number) {}

  decide(context: StrategyContext): TradeDecision {
    if (this.#coolDownUntil && context.market.timestamp < this.#coolDownUntil) {
      return {
        action: "HOLD",
        size: 0,
        reason: "Cooling down after stop",
        confidence: 0,
      };
    }
    const trend = this.#computeTrend(context.market.price);
    const sentimentScore = this.aggregateSentiment(context.sentiment);
    const decision = this.evaluate(context, trend, sentimentScore);
    if (decision.action !== "HOLD" && decision.size <= 0) {
      throw new Error("Non-hold decisions must have positive size");
    }
    if (decision.action === "SELL" && !this.hasPosition(context)) {
      return {
        action: "HOLD",
        size: 0,
        reason: "No holdings to sell",
        confidence: 0,
      };
    }
    if (decision.reason.includes("stop")) {
      this.#coolDownUntil = new Date(context.market.timestamp.getTime() + this.coolDownMillis);
    }
    this.#lastPrice = context.market.price;
    return decision;
  }

  protected abstract evaluate(
    context: StrategyContext,
    trend: number,
    sentimentScore: number,
  ): TradeDecision;

  protected aggregateSentiment(sentiments: StrategyContext["sentiment"]): number {
    if (!sentiments.length) return 0;
    const totalWeight = sentiments.reduce((acc, item) => acc + item.confidence, 0);
    if (totalWeight === 0) return 0;
    return sentiments.reduce((acc, item) => acc + item.score * item.confidence, 0) / totalWeight;
  }

  protected hasPosition(context: StrategyContext): boolean {
    return Object.values(context.portfolio.holdings).some((position) => position.amount > 0);
  }

  get lastPrice(): number | undefined {
    return this.#lastPrice;
  }

  #computeTrend(currentPrice: number): number {
    if (this.#lastPrice === undefined) {
      return 0;
    }
    return (currentPrice - this.#lastPrice) / this.#lastPrice;
  }

  private get coolDownMillis(): number {
    return this.coolDownMinutes * 60 * 1000;
  }
}
