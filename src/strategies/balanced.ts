import { BaseStrategy } from "./base_strategy.ts";
import { StrategyContext, TradeDecision } from "../types.ts";

export class BalancedStrategy extends BaseStrategy {
  constructor() {
    super(60);
  }

  protected evaluate(
    context: StrategyContext,
    trend: number,
    sentimentScore: number,
  ): TradeDecision {
    const capital = context.portfolio.cash;
    const allocation = Math.min(0.6, Math.max(0.2, sentimentScore + 0.4));
    const positionAmount = (capital * allocation) / context.market.price;

    if (trend > 0.0015 && sentimentScore > 0.05) {
      return {
        action: "BUY",
        size: positionAmount,
        reason: "Trend-following entry with supportive sentiment",
        confidence: 0.6 + sentimentScore / 2,
        stopLoss: context.market.price * 0.97,
        takeProfit: context.market.price * 1.05,
        holdPeriodMinutes: 720,
      };
    }

    if (trend < -0.001 && sentimentScore < -0.05 && this.hasPosition(context)) {
      return {
        action: "SELL",
        size: this.#currentAmount(context),
        reason: "Trend breakdown with negative sentiment",
        confidence: 0.55,
        stopLoss: context.market.price * 1.02,
        takeProfit: context.market.price * 0.96,
      };
    }

    if (this.hasPosition(context) && sentimentScore < -0.2) {
      return {
        action: "SELL",
        size: this.#currentAmount(context) * 0.5,
        reason: "Sentiment deterioration risk control",
        confidence: 0.5,
        stopLoss: context.market.price * 1.015,
      };
    }

    return {
      action: "HOLD",
      size: 0,
      reason: "Awaiting clear signals",
      confidence: 0.4,
    };
  }

  #currentAmount(context: StrategyContext): number {
    const position = context.portfolio.holdings[context.market.symbol];
    return position ? position.amount : 0;
  }
}
