import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { defaultConfig } from '../hltv-lib/config';
import { getMatch } from '../hltv-lib/endpoints/getMatch';
import { getEvents } from '../hltv-lib/endpoints/getEvents';
import { getEventMatches } from '../hltv-lib/endpoints/getEventMatches';
import type { FullMatch as HltvMatch } from '../hltv-lib/endpoints/getMatch';
import type { EventPreview } from '../hltv-lib/endpoints/getEvents';
import type { EventMatchPreview } from '../hltv-lib/endpoints/getEventMatches';

@Injectable()
export class HltvService {
  private readonly logger = new Logger(HltvService.name);

  constructor(private config: ConfigService) {}

  private readonly hltvGetMatch = getMatch(defaultConfig);
  private readonly hltvGetEvents = getEvents(defaultConfig);
  private readonly hltvGetEventMatches = getEventMatches(defaultConfig);

  // Rate limiter: HLTV_RATE_LIMIT requests per HLTV_RATE_WINDOW_MS (default 5 per 20s)
  private requestTimestamps: number[] = [];
  private get rateLimit(): number {
    return this.config.get<number>('HLTV_RATE_LIMIT', 5);
  }
  private get rateWindowMs(): number {
    return this.config.get<number>('HLTV_RATE_WINDOW_MS', 20_000);
  }

  // Circuit breaker
  private consecutiveErrors = 0;
  private circuitOpenUntil: number | null = null;
  private get errorThreshold(): number {
    return this.config.get<number>('HLTV_CIRCUIT_BREAKER_THRESHOLD', 3);
  }
  private get circuitOpenMs(): number {
    return this.config.get<number>(
      'HLTV_CIRCUIT_BREAKER_COOLDOWN_MS',
      15 * 60 * 1000,
    );
  }

  private isCircuitOpen(): boolean {
    if (!this.circuitOpenUntil) return false;
    if (Date.now() >= this.circuitOpenUntil) {
      this.circuitOpenUntil = null;
      return false;
    }
    return true;
  }

  private openCircuit(): void {
    this.circuitOpenUntil = Date.now() + this.circuitOpenMs;
    this.logger.warn(
      `Circuit breaker OPEN — pausing HLTV requests for ${this.circuitOpenMs / 60000}min (${this.consecutiveErrors} consecutive errors)`,
    );
  }

  // Serial queue — ensures requests don't overlap and respects rate limit
  private pending: Promise<unknown> = Promise.resolve();

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (t) => now - t < this.rateWindowMs,
    );

    if (this.requestTimestamps.length >= this.rateLimit) {
      const oldestInWindow = this.requestTimestamps[0];
      const waitMs = this.rateWindowMs - (now - oldestInWindow) + 100;
      this.logger.debug(
        `Rate limit (${this.rateLimit}/${this.rateWindowMs}ms): waiting ${waitMs}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    this.requestTimestamps.push(Date.now());
  }

  private enqueue<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    const task = this.pending.then(async () => {
      if (this.isCircuitOpen()) {
        this.logger.debug(`Circuit open — skipping: ${label}`);
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
          `HLTV request failed (${label}): ${message} [${this.consecutiveErrors}/${this.errorThreshold}]`,
        );
        if (this.consecutiveErrors >= this.errorThreshold) {
          this.openCircuit();
        }
        return null;
      }
    });

    // Chain so next request waits for this one
    this.pending = task.catch(() => {});
    return task;
  }

  /** Fetch ongoing + upcoming HLTV events list (1 request), limited to first N */
  async getEvents(
    limit = this.config.get<number>('HLTV_MAX_EVENTS', 10),
  ): Promise<EventPreview[] | null> {
    this.logger.debug('Queuing HLTV getEvents...');
    const events = await this.enqueue('getEvents', () =>
      this.hltvGetEvents(),
    );
    if (events) {
      const limited = events.slice(0, limit);
      this.logger.debug(
        `HLTV getEvents → ${events.length} total, using first ${limited.length}`,
      );
      for (const e of limited) {
        this.logger.debug(`  [${e.id}] ${e.name}`);
      }
      return limited;
    }
    return events;
  }

  /** Fetch all matches for a specific HLTV event (1 request) */
  async getEventMatches(eventId: number): Promise<EventMatchPreview[] | null> {
    this.logger.debug(`Queuing HLTV getEventMatches(${eventId})...`);
    const matches = await this.enqueue(`getEventMatches(${eventId})`, () =>
      this.hltvGetEventMatches({ id: eventId }),
    );
    if (matches) {
      this.logger.debug(
        `HLTV getEventMatches(${eventId}) → ${matches.length} matches`,
      );
      for (const m of matches) {
        if (!m.team1?.name || !m.team2?.name) continue;
        this.logger.debug(
          `  [${m.id}] ${m.team1.name} vs ${m.team2.name} | live=${m.live} | date=${m.date ? new Date(m.date).toISOString() : '?'}`,
        );
      }
    }
    return matches;
  }

  /** Fetch full match details including odds (1 request) */
  async getMatch(id: number): Promise<HltvMatch | null> {
    this.logger.debug(`Queuing HLTV getMatch(${id})...`);
    const match = await this.enqueue(`getMatch(${id})`, () =>
      this.hltvGetMatch({ id }),
    );
    if (match) {
      this.logger.debug(
        `HLTV getMatch(${id}) → ${match.team1?.name ?? '?'} vs ${match.team2?.name ?? '?'} | status=${match.status} | odds=${match.odds?.length ?? 0} providers`,
      );
      if (match.odds?.length) {
        const top = match.odds.slice(0, 5);
        for (const o of top) {
          this.logger.debug(
            `  odds: ${o.provider} → ${o.team1} / ${o.team2}`,
          );
        }
      }
    }
    return match;
  }
}
