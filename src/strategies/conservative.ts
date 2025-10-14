import { BaseStrategy } from "./base_strategy.ts";
import { StrategyContext, TradeDecision } from "../types.ts";

export class ConservativeStrategy extends BaseStrategy {
  constructor() {
    super(120);
  }

  protected evaluate(
    context: StrategyContext,
    trend: number,
    sentimentScore: number,
  ): TradeDecision {
    const cash = context.portfolio.cash;
    const desiredExposure = (cash * Math.max(0.1, Math.min(0.3, sentimentScore + 0.3))) /
      context.market.price;

    if (trend > 0.0008 && sentimentScore > 0.1) {
      return {
        action: "BUY",
        size: desiredExposure,
        reason: "Gradual accumulation",
        confidence: 0.5,
        stopLoss: context.market.price * 0.985,
        takeProfit: context.market.price * 1.025,
        holdPeriodMinutes: 1440,
      };
    }

    if ((trend < -0.0005 || sentimentScore < -0.05) && this.hasPosition(context)) {
      return {
        action: "SELL",
        size: this.#currentAmount(context),
        reason: "Risk-off trigger",
        confidence: 0.45,
        stopLoss: context.market.price * 1.01,
        takeProfit: context.market.price * 0.985,
      };
    }

    return {
      action: "HOLD",
      size: 0,
      reason: "Preserving capital",
      confidence: 0.35,
    };
  }

  #currentAmount(context: StrategyContext): number {
    const position = context.portfolio.holdings[context.market.symbol];
    return position ? position.amount : 0;
  }
}
