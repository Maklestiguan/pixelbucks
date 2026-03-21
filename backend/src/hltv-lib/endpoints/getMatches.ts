import { stringify } from 'querystring';
import { HLTVConfig } from '../config';
import { HLTVScraper } from '../scraper';
import { Team } from '../shared/Team';
import { Event } from '../shared/Event';
import { fetchPage, getIdAt } from '../utils';

export enum MatchEventType {
  All = 'All',
  LAN = 'Lan',
  Online = 'Online',
}

export enum MatchFilter {
  LanOnly = 'lan_only',
  TopTier = 'top_tier',
}

export interface GetMatchesArguments {
  eventIds?: number[];
  eventType?: MatchEventType;
  filter?: MatchFilter;
  teamIds?: number[];
}

export interface MatchPreview {
  id: number;
  team1?: Team;
  team2?: Team;
  date?: number;
  format?: string;
  event?: Event;
  title?: string;
  live: boolean;
  stars: number;
}

export const getMatches =
  (config: HLTVConfig) =>
  async ({
    eventIds,
    eventType,
    filter,
    teamIds,
  }: GetMatchesArguments = {}): Promise<MatchPreview[]> => {
    const query = stringify({
      ...(eventIds ? { event: eventIds } : {}),
      ...(eventType ? { eventType } : {}),
      ...(filter ? { predefinedFilter: filter } : {}),
      ...(teamIds ? { team: teamIds } : {}),
    });

    const $ = HLTVScraper(
      await fetchPage(`https://www.hltv.org/matches?${query}`, config.loadPage),
    );

    // Build event lookup from filter popups
    const events = $('.event-filter-popup a')
      .toArray()
      .map((el) => ({
        id: el.attrThen('href', (x) => Number(x.split('=').pop())),
        name: el.find('.event-name').text(),
      }))
      .concat(
        $('.events-container a')
          .toArray()
          .map((el) => ({
            id: el.attrThen('href', (x) => Number(x.split('=').pop())),
            name: el.find('.featured-event-tooltip-content').text(),
          })),
      );

    // HLTV updated class names from camelCase to kebab-case — support both
    const matchEls = $('.liveMatch-container')
      .toArray()
      .concat($('.live-match-container').toArray())
      .concat($('.upcomingMatch').toArray())
      .concat($('.upcoming-match').toArray());

    return matchEls.map((el) => {
      const id = el.find('.a-reset').attrThen('href', getIdAt(2))!;

      // Stars: old = .matchRating i.faded, new = .match-rating .fa-star.faded
      const fadedCount =
        el.find('.matchRating i.faded').length ||
        el.find('.match-rating .fa-star.faded').length;
      const stars = 5 - fadedCount;

      // Live detection: old = .matchTime.matchLive, new = .match-meta-live
      const live =
        el.find('.matchTime.matchLive').text() === 'LIVE' ||
        el.find('.match-meta-live').text() === 'Live';

      const title =
        el.find('.matchInfoEmpty').text() ||
        el.find('.match-info-empty').text() ||
        undefined;

      // Date: old = .matchTime[data-unix], new via data attr on wrapper
      const date =
        el.find('.matchTime').numFromAttr('data-unix') ||
        el.find('.match-time').numFromAttr('data-unix') ||
        el.numFromAttr('data-zonedgrouping-entry-unix');

      let team1;
      let team2;

      if (!title) {
        team1 = {
          name:
            el.find('.matchTeamName').first().text() ||
            el.find('.match-teamname').first().text() ||
            el.find('.team1 .team').text(),
          id: el.numFromAttr('team1'),
        };

        team2 = {
          name:
            el.find('.matchTeamName').eq(1).text() ||
            el.find('.match-teamname').eq(1).text() ||
            el.find('.team2 .team').text(),
          id: el.numFromAttr('team2'),
        };
      }

      const format =
        el.find('.matchMeta').text() || el.find('.match-meta').text();

      const eventName =
        el.find('.matchEventLogo').attr('title') ||
        el.find('.match-event-logo').attr('title');
      const event = events.find((x) => x.name === eventName);

      return { id, date, stars, title, team1, team2, format, event, live };
    });
  };
