import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

const KEY_CS2_ALLOW = 'settings:cs2AllowBetsWithoutHltv';
// ~1 year — effectively persistent. The global CacheModule's default TTL is
// only 30s, so we MUST pass an explicit TTL on every set() or the value
// would silently expire.
const PERSISTENT_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export interface AppSettings {
  cs2AllowBetsWithoutHltv: boolean;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async get(): Promise<AppSettings> {
    return {
      cs2AllowBetsWithoutHltv: await this.readBool(KEY_CS2_ALLOW),
    };
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    if (patch.cs2AllowBetsWithoutHltv !== undefined) {
      await this.writeBool(KEY_CS2_ALLOW, patch.cs2AllowBetsWithoutHltv);
    }
    return this.get();
  }

  private async readBool(key: string): Promise<boolean> {
    try {
      const raw = await this.cache.get<boolean>(key);
      return raw === true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to read setting ${key}, falling back to false: ${message}`,
      );
      return false;
    }
  }

  private async writeBool(key: string, value: boolean): Promise<void> {
    await this.cache.set(key, value, PERSISTENT_TTL_MS);
  }
}
