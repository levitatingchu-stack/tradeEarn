import { StrategyConfig } from "../config/config.ts";
import { StrategyContext, StrategyType, TradeDecision } from "../types.ts";

export interface EnforcedDecision {
  action: "BUY" | "SELL" | "HOLD";
  size: number;
  reason: string;
  confidence: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface RiskState {
  maxDrawdownPct: number;
  dailyLoss: number;
}

export class RiskManager {
  #state: Record<StrategyType, RiskState> = {
    aggressive: { maxDrawdownPct: 0, dailyLoss: 0 },
    balanced: { maxDrawdownPct: 0, dailyLoss: 0 },
    conservative: { maxDrawdownPct: 0, dailyLoss: 0 },
  };

  enforce(
    strategy: StrategyConfig,
    context: StrategyContext,
    decision: TradeDecision,
  ): EnforcedDecision {
    if (decision.action === "HOLD") {
      return { ...decision };
    }

    const currentState = this.#state[strategy.type];
    const equity = this.#equity(context);
    if (equity <= 0) {
      return {
        action: "HOLD",
        size: 0,
        reason: "No equity available",
        confidence: 0,
      };
    }

    const dailyLossLimit = strategy.dailyLossLimit * equity;
    if (currentState.dailyLoss <= -dailyLossLimit) {
      return {
        action: "HOLD",
        size: 0,
        reason: "Daily loss limit reached",
        confidence: 0,
      };
    }

    if (decision.action === "BUY") {
      const maxAffordable = context.portfolio.cash / context.market.price;
      const allowed = Math.max(0, Math.min(decision.size, maxAffordable));
      if (allowed === 0) {
        return {
          action: "HOLD",
          size: 0,
          reason: "Insufficient cash for spot position",
          confidence: 0,
        };
      }
      return { ...decision, size: allowed };
    }

    const holdingAmount = this.#holdingAmount(context);
    if (holdingAmount <= 0) {
      return {
        action: "HOLD",
        size: 0,
        reason: "No spot holdings to sell",
        confidence: 0,
      };
    }
    const allowedSell = Math.max(0, Math.min(decision.size, holdingAmount));
    if (allowedSell === 0) {
      return {
        action: "HOLD",
        size: 0,
        reason: "Nothing available to liquidate",
        confidence: 0,
      };
    }
    return { ...decision, size: allowedSell };
  }

  updatePerformance(
    strategy: StrategyType,
    realizedPnl: number,
    peakEquity: number,
    currentEquity: number,
  ) {
    const state = this.#state[strategy];
    state.dailyLoss += realizedPnl;
    if (peakEquity > 0) {
      const drawdown = (peakEquity - currentEquity) / peakEquity;
      state.maxDrawdownPct = Math.max(state.maxDrawdownPct, drawdown);
    }
  }

  resetDailyLoss() {
    for (const key of Object.keys(this.#state) as StrategyType[]) {
      this.#state[key].dailyLoss = 0;
    }
  }

  private #equity(context: StrategyContext): number {
    const holdingsValue = this.#holdingAmount(context) * context.market.price;
    return context.portfolio.cash + holdingsValue;
  }

  private #holdingAmount(context: StrategyContext): number {
    const holding = context.portfolio.holdings[context.market.symbol];
    return holding ? holding.amount : 0;
  }
}
