import { SentimentSnapshot, StrategyType } from "../types.ts";

export interface SentimentProvider {
  fetch(symbol: string): Promise<SentimentSnapshot[]>;
}

export class StaticSentimentProvider implements SentimentProvider {
  constructor(private readonly baseScore: number, private readonly noise = 0.15) {}

  async fetch(symbol: string): Promise<SentimentSnapshot[]> {
    await Promise.resolve(); // Keep async for interface compatibility
    const now = new Date();
    const jitter = () => (Math.random() - 0.5) * this.noise;
    return [
      {
        source: `${symbol}-news`,
        score: Math.max(-1, Math.min(1, this.baseScore + jitter())),
        confidence: 0.6,
        timestamp: now,
      },
      {
        source: `${symbol}-social`,
        score: Math.max(-1, Math.min(1, this.baseScore + jitter())),
        confidence: 0.4,
        timestamp: now,
      },
    ];
  }
}

export class SentimentDataService {
  constructor(private readonly provider: SentimentProvider) {}

  async compositeScore(symbol: string, strategy: StrategyType): Promise<SentimentSnapshot[]> {
    const snapshots = await this.provider.fetch(symbol);
    return snapshots.map((snapshot) => ({
      ...snapshot,
      confidence: this.#adjustConfidence(snapshot.confidence, strategy),
    }));
  }

  #adjustConfidence(confidence: number, strategy: StrategyType): number {
    switch (strategy) {
      case "aggressive":
        return Math.min(1, confidence + 0.2);
      case "conservative":
        return Math.max(0.1, confidence - 0.1);
      default:
        return confidence;
    }
  }
}
