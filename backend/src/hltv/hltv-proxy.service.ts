import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HltvProxyService {
  private readonly logger = new Logger(HltvProxyService.name);
  private proxies: string[] = [];
  private currentIndex = 0;
  private badProxies = new Map<string, number>(); // proxy → cooldown timestamp
  private readonly badCooldownMs = 5 * 60 * 1000; // 5 min cooldown for bad proxies

  constructor(private config: ConfigService) {
    const list = this.config.get<string>('HLTV_PROXY_LIST', '');
    this.proxies = list
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    if (this.proxies.length > 0) {
      this.logger.log(
        `Loaded ${this.proxies.length} proxies: ${this.proxies.join(', ')}`,
      );
    } else {
      this.logger.warn('No proxies configured (HLTV_PROXY_LIST is empty)');
    }
  }

  get enabled(): boolean {
    return (
      this.config.get<string>('HLTV_PROXY_ENABLED', 'true') === 'true' &&
      this.proxies.length > 0
    );
  }

  /** Returns the next available proxy URL in round-robin, or null if none available */
  getProxy(): string | null {
    if (this.proxies.length === 0) return null;

    const now = Date.now();
    // Clean up expired bad proxies
    for (const [proxy, until] of this.badProxies) {
      if (now >= until) this.badProxies.delete(proxy);
    }

    // Try up to proxies.length times to find a good one
    for (let i = 0; i < this.proxies.length; i++) {
      const proxy = this.proxies[this.currentIndex % this.proxies.length];
      this.currentIndex++;

      if (!this.badProxies.has(proxy)) {
        return `http://${proxy}`;
      }
    }

    // All proxies are bad — return the first one anyway (cooldown might expire soon)
    this.logger.warn('All proxies marked as bad, using first one');
    return `http://${this.proxies[0]}`;
  }

  /** Mark a proxy as temporarily bad */
  reportBad(proxyUrl: string) {
    // Strip http:// prefix to match stored format
    const raw = proxyUrl.replace(/^https?:\/\//, '');
    this.badProxies.set(raw, Date.now() + this.badCooldownMs);
    this.logger.warn(
      `Proxy marked bad: ${raw} (cooldown ${this.badCooldownMs / 1000}s)`,
    );
  }
}
