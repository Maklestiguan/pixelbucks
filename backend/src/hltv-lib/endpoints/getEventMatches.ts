import { HLTVConfig } from '../config';
import { HLTVScraper } from '../scraper';
import { Team } from '../shared/Team';
import { fetchPage, getIdAt } from '../utils';

export interface EventMatchPreview {
  id: number;
  team1?: Team;
  team2?: Team;
  date?: number;
  format?: string;
  title?: string;
  live: boolean;
  stars: number;
}

export const getEventMatches =
  (config: HLTVConfig) =>
  async ({ id }: { id: number }): Promise<EventMatchPreview[]> => {
    const $ = HLTVScraper(
      await fetchPage(
        `https://www.hltv.org/events/${id}/matches`,
        config.loadPage,
      ),
    );

    // All matches on event page are inside .mainContent
    const matchEls = $('.mainContent .match-wrapper').toArray();
    console.debug(`[HLTV] getEventMatches(${id}) → ${matchEls.length} matches found`);

    const results: EventMatchPreview[] = [];

    for (const el of matchEls) {
        const linkEl = el.find('.a-reset');
        if (!linkEl.exists()) continue;

        const href = linkEl.attr('href');
        if (!href) continue;

        const matchId = getIdAt(2, href);
        if (!matchId) continue;

        // Stars from .match-rating (both old matchRating and new)
        const fadedCount =
          el.find('.matchRating i.faded').length ||
          el.find('.match-rating .fa-star.faded').length;
        const stars = 5 - fadedCount;

        // Live detection
        const live =
          el.find('.match-meta-live').text() === 'Live' ||
          el.attr('live') === 'true';

        // Date: from .match-time[data-unix] inside, or parent's data-zonedgrouping-entry-unix
        const date =
          el.find('.match-time').numFromAttr('data-unix') ||
          el.find('.matchTime').numFromAttr('data-unix') ||
          el.parent().numFromAttr('data-zonedgrouping-entry-unix');

        // Title for TBD matches (no teams)
        const title =
          el.find('.match-no-info .line-clamp-3').trimText() ||
          el.find('.matchInfoEmpty').trimText() ||
          undefined;

        let team1: Team | undefined;
        let team2: Team | undefined;

        const team1Name =
          el.find('.match-teamname').first().text() ||
          el.find('.matchTeamName').first().text();
        const team2Name =
          el.find('.match-teamname').eq(1).text() ||
          el.find('.matchTeamName').eq(1).text();

        if (team1Name) {
          team1 = {
            name: team1Name,
            id: el.numFromAttr('team1'),
          };
        }

        if (team2Name) {
          team2 = {
            name: team2Name,
            id: el.numFromAttr('team2'),
          };
        }

        const format =
          el.find('.match-meta').last().text() ||
          el.find('.matchMeta').text();

        results.push({
          id: matchId,
          date,
          stars,
          title,
          team1,
          team2,
          format,
          live,
        });
    }

    return results;
  };
