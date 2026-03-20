import { Injectable, Logger } from '@nestjs/common';
import { Hltv } from '../hltv-lib';
import type { FullMatch as HltvMatch } from '../hltv-lib/endpoints/getMatch';
import type { MatchPreview } from '../hltv-lib/endpoints/getMatches';

@Injectable()
export class HltvService {
  private readonly logger = new Logger(HltvService.name);
  private readonly client = new Hltv();

  // Rate limiter: max 5 requests per 60s
  private requestTimestamps: number[] = [];
  private readonly MAX_REQUESTS = 5;
  private readonly WINDOW_MS = 60_000;

  // Circuit breaker: 3 consecutive errors → 15min cooldown
  private consecutiveErrors = 0;
  private circuitOpenUntil: number | null = null;
  private readonly ERROR_THRESHOLD = 3;
  private readonly CIRCUIT_OPEN_MS = 15 * 60 * 1000;

  private isCircuitOpen(): boolean {
    if (!this.circuitOpenUntil) return false;
    if (Date.now() >= this.circuitOpenUntil) {
      this.circuitOpenUntil = null; // half-open: allow next request
      return false;
    }
    return true;
  }

  private openCircuit(): void {
    this.circuitOpenUntil = Date.now() + this.CIRCUIT_OPEN_MS;
    this.logger.warn(
      `Circuit breaker OPEN — pausing HLTV requests for 15 minutes (${this.consecutiveErrors} consecutive errors)`,
    );
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (t) => now - t < this.WINDOW_MS,
    );

    if (this.requestTimestamps.length >= this.MAX_REQUESTS) {
      const oldestInWindow = this.requestTimestamps[0];
      const waitMs = this.WINDOW_MS - (now - oldestInWindow) + 100;
      this.logger.debug(`Rate limit reached, waiting ${waitMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    this.requestTimestamps.push(Date.now());
  }

  private async execute<T>(
    label: string,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    if (this.isCircuitOpen()) {
      this.logger.debug(`Circuit open — skipping HLTV request: ${label}`);
      return null;
    }

    await this.waitForRateLimit();

    try {
      const result = await fn();
      this.consecutiveErrors = 0;
      return result;
    } catch (err: unknown) {
      this.consecutiveErrors++;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `HLTV request failed (${label}): ${message} [${this.consecutiveErrors}/${this.ERROR_THRESHOLD}]`,
      );

      if (this.consecutiveErrors >= this.ERROR_THRESHOLD) {
        this.openCircuit();
      }

      return null;
    }
  }

  async getMatches(): Promise<MatchPreview[] | null> {
    return this.execute('getMatches', () => this.client.getMatches());
  }

  async getMatch(id: number): Promise<HltvMatch | null> {
    return this.execute(`getMatch(${id})`, () => this.client.getMatch({ id }));
  }
}
