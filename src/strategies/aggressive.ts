import { BaseStrategy } from "./base_strategy.ts";
import { StrategyContext, TradeDecision } from "../types.ts";

export class AggressiveStrategy extends BaseStrategy {
  #momentumThreshold = 0.004;

  constructor() {
    super(30); // 30 minute cool down
  }

  protected evaluate(
    context: StrategyContext,
    trend: number,
    sentimentScore: number,
  ): TradeDecision {
    const riskBudget = context.config.riskBudget;
    const cash = context.portfolio.cash;
    const basePositionSize = (cash * Math.min(1, sentimentScore + 0.6)) / context.market.price;

    if (trend > this.#momentumThreshold && sentimentScore > 0.2) {
      return {
        action: "BUY",
        size: basePositionSize,
        reason: `Momentum breakout with sentiment ${sentimentScore.toFixed(2)}`,
        confidence: Math.min(1, sentimentScore + trend * 10),
        stopLoss: context.market.price * 0.94,
        takeProfit: context.market.price * 1.08,
        holdPeriodMinutes: 240,
      };
    }

    if (trend < -this.#momentumThreshold && this.hasPosition(context)) {
      return {
        action: "SELL",
        size: this.#positionAmount(context),
        reason: `Momentum reversal detected (${trend.toFixed(3)})`,
        confidence: Math.min(1, -trend * 10),
        stopLoss: context.market.price * 1.03,
        takeProfit: context.market.price * 0.92,
      };
    }

    if (sentimentScore < -riskBudget) {
      return {
        action: "SELL",
        size: this.#positionAmount(context),
        reason: "Sentiment stop triggered",
        confidence: 0.7,
        stopLoss: context.market.price * 1.03,
      };
    }

    return {
      action: "HOLD",
      size: 0,
      reason: "Conditions not met",
      confidence: 0.3,
    };
  }

  #positionAmount(context: StrategyContext): number {
    const holding = context.portfolio.holdings[context.market.symbol];
    return holding ? holding.amount : 0;
  }
}
