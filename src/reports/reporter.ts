import { AccountSnapshot, DailyPerformance, TradeRecord } from "../types.ts";

export class Reporter {
  buildDailyPerformance(
    snapshots: AccountSnapshot[],
    trades: TradeRecord[],
  ): DailyPerformance[] {
    const grouped = new Map<string, AccountSnapshot[]>();
    for (const snapshot of snapshots) {
      const dateKey = this.#dateKey(snapshot.timestamp, snapshot.strategy);
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(snapshot);
    }

    const tradeCount = this.#tradeCountByDate(trades);

    const results: DailyPerformance[] = [];
    for (const [key, values] of grouped.entries()) {
      const [strategy, date] = key.split("|");
      const sorted = values.toSorted((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const startEquity = sorted[0].equity;
      const endEquity = sorted[sorted.length - 1].equity;
      const maxEquity = Math.max(...sorted.map((item) => item.equity));
      const minEquity = Math.min(...sorted.map((item) => item.equity));
      const pnl = endEquity - startEquity;
      const returnPct = startEquity === 0 ? 0 : pnl / startEquity;
      const maxDrawdownPct = maxEquity === 0 ? 0 : (maxEquity - minEquity) / maxEquity;
      results.push({
        strategy: strategy as DailyPerformance["strategy"],
        date,
        pnl,
        returnPct,
        maxDrawdownPct,
        trades: tradeCount.get(key) ?? 0,
      });
    }
    return results.toSorted((a, b) => a.date.localeCompare(b.date));
  }

  renderMarkdown(performance: DailyPerformance[]): string {
    const header = "| 策略 | 日期 | 收益 (¥) | 收益率 | 最大回撤 | 交易次数 |\n| --- | --- | ---: | ---: | ---: | ---: |";
    const rows = performance.map((item) => {
      const pnl = item.pnl.toFixed(2);
      const ret = (item.returnPct * 100).toFixed(2) + "%";
      const dd = (item.maxDrawdownPct * 100).toFixed(2) + "%";
      return `| ${item.strategy} | ${item.date} | ${pnl} | ${ret} | ${dd} | ${item.trades} |`;
    });
    return [header, ...rows].join("\n");
  }

  #dateKey(timestamp: Date, strategy: string): string {
    const date = timestamp.toISOString().slice(0, 10);
    return `${strategy}|${date}`;
  }

  #tradeCountByDate(trades: TradeRecord[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const trade of trades) {
      const key = this.#dateKey(trade.timestamp, trade.strategy);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }
}
