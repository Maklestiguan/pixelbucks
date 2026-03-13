import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';
import { inspect } from 'node:util';

export interface PandascoreStream {
  main: boolean;
  language: string;
  embed_url: string | null;
  official: boolean;
  raw_url: string | null;
}

export interface PandascoreMatch {
  id: number;
  name: string;
  status: 'not_started' | 'running' | 'finished' | 'canceled';
  scheduled_at: string;
  begin_at: string | null;
  end_at: string | null;
  opponents: Array<{
    opponent: {
      id: number;
      name: string;
      image_url: string | null;
    };
    type: string;
  }>;
  results: Array<{
    team_id: number;
    score: number;
  }>;
  winner: {
    id: number;
    name: string;
  } | null;
  winner_id: number | null;
  tournament: {
    id: number;
    name: string;
    slug: string;
  };
  league: {
    id: number;
    name: string;
  };
  serie: {
    id: number;
    tier: string | null;
  } | null;
  videogame: {
    id: number;
    name: string;
    slug: string;
  };
  number_of_games: number;
  streams_list?: PandascoreStream[];
}

export interface PandascoreTournament {
  id: number;
  name: string;
  slug: string;
  tier: string | null;
  videogame: {
    id: number;
    name: string;
    slug: string;
  };
  serie: {
    id: number;
    tier: string | null;
  } | null;
  league: {
    id: number;
    name: string;
  };
}

@Injectable()
export class PandascoreService {
  private readonly logger = new Logger(PandascoreService.name);
  private readonly client: AxiosInstance;

  readonly tiers: string[];

  constructor(private config: ConfigService) {
    const baseURL = config.get<string>(
      'PANDASCORE_BASE_URL',
      'https://api.pandascore.co',
    );
    const token = config.get<string>('PANDASCORE_TOKEN', '');
    this.tiers = config
      .get<string>('PANDASCORE_TIERS', 's,a')
      .split(',')
      .map((t) => t.trim());

    this.client = axios.create({
      baseURL,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
  }

  async getUpcomingMatches(
    game: 'dota2' | 'csgo',
    options?: { tournamentIds?: number[]; page?: number; perPage?: number },
  ): Promise<PandascoreMatch[]> {
    const { tournamentIds, page = 1, perPage = 50 } = options || {};
    return this.fetchMatches(game, 'upcoming', page, perPage, tournamentIds);
  }

  async getRunningMatches(
    game: 'dota2' | 'csgo',
    options?: { tournamentIds?: number[]; page?: number; perPage?: number },
  ): Promise<PandascoreMatch[]> {
    const { tournamentIds, page = 1, perPage = 50 } = options || {};
    return this.fetchMatches(game, 'running', page, perPage, tournamentIds);
  }

  async getMatch(matchId: number): Promise<PandascoreMatch | null> {
    try {
      const { data } = await this.client.get<PandascoreMatch>(
        `/matches/${matchId}`,
      );
      return data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to fetch match ${matchId}: ${message}`);
      return null;
    }
  }

  async getTournaments(
    game: 'dota2' | 'csgo',
    page = 1,
    perPage = 50,
  ): Promise<PandascoreTournament[]> {
    try {
      const { data } = await this.client.get<PandascoreTournament[]>(
        `/${game}/tournaments`,
        {
          params: {
            page,
            per_page: perPage,
            sort: '-begin_at',
          },
        },
      );
      return data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        this.logger.warn(`PandaScore rate limit hit for ${game}/tournaments`);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to fetch ${game}/tournaments: ${message}`);
      }
      return [];
    }
  }

  private async fetchMatches(
    game: string,
    status: string,
    page: number,
    perPage: number,
    tournamentIds?: number[],
  ): Promise<PandascoreMatch[]> {
    try {
      const params: Record<string, any> = {
        page,
        per_page: perPage,
      };
      if (tournamentIds?.length) {
        params['filter[tournament_id]'] = tournamentIds.join(',');
      }
      const { data } = await this.client.get<PandascoreMatch[]>(
        `/${game}/matches/${status}`,
        { params },
      );
      return data;
    } catch (err: unknown) {
      this.logger.debug(
        `Failed to fetch ${game}/${status}: ${inspect(err, { depth: 3 })}`,
      );
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        this.logger.warn(`PandaScore rate limit hit for ${game}/${status}`);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to fetch ${game}/${status}: ${message}`);
      }
      return [];
    }
  }
}
