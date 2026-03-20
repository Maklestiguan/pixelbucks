/**
 * Team name matching utility for mapping PandaScore events to HLTV matches.
 *
 * PandaScore and HLTV may use slightly different team names:
 * "Natus Vincere" vs "NAVI", "FaZe Clan" vs "FaZe", "G2 Esports" vs "G2"
 */

const STRIP_SUFFIXES = ['esports', 'gaming', 'team', 'clan', 'gg', 'org', 'fe'];

const TEAM_ALIASES: Record<string, string[]> = {
  'natus vincere': ['navi'],
  virtuspro: ['vp', 'virtus pro', 'virtus.pro'],
  'ninjas in pyjamas': ['nip'],
  g2: ['g2 esports'],
  faze: ['faze clan'],
  complexity: ['col', 'complexity gaming'],
  cloud9: ['c9'],
  fnatic: ['fnc'],
  og: ['og esports'],
  big: ['big clan'],
  heroic: ['heroic gg'],
  monte: ['monte esports'],
  'eternal fire': ['ef'],
  mouz: ['mousesports'],
  'the mongolz': ['mongolz'],
  '9 pandas': ['9pandas', '9p'],
  b8: ['b8 esports'],
  apeks: ['apeks esports'],
};

export function normalizeTeamName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Strip common suffixes
  for (const suffix of STRIP_SUFFIXES) {
    const regex = new RegExp(`\\s+${suffix}$`, 'i');
    normalized = normalized.replace(regex, '');
  }

  // Remove non-alphanumeric except spaces
  normalized = normalized.replace(/[^a-z0-9\s]/g, '').trim();
  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}

function getAliases(normalized: string): string[] {
  const aliases: string[] = [normalized];

  // Check if this name is a key in the alias map
  if (TEAM_ALIASES[normalized]) {
    aliases.push(...TEAM_ALIASES[normalized]);
  }

  // Check if this name appears as a value in the alias map
  for (const [key, values] of Object.entries(TEAM_ALIASES)) {
    if (values.includes(normalized)) {
      aliases.push(key, ...values.filter((v) => v !== normalized));
    }
  }

  return [...new Set(aliases)];
}

function teamsMatch(nameA: string, nameB: string): boolean {
  const normA = normalizeTeamName(nameA);
  const normB = normalizeTeamName(nameB);

  // Exact match after normalization
  if (normA === normB) return true;

  // Check aliases
  const aliasesA = getAliases(normA);
  const aliasesB = getAliases(normB);

  for (const a of aliasesA) {
    for (const b of aliasesB) {
      if (a === b) return true;
    }
  }

  // Substring containment (one contains the other, both > 2 chars)
  if (normA.length > 2 && normB.length > 2) {
    if (normA.includes(normB) || normB.includes(normA)) return true;
  }

  return false;
}

export interface MatchResult {
  matched: boolean;
  /** true if HLTV team1 maps to PandaScore teamB (teams are swapped) */
  swapped: boolean;
}

/**
 * Check if HLTV match teams correspond to a PandaScore event's teams.
 * Returns { matched, swapped } where swapped indicates team order differs.
 */
export function matchTeams(
  hltvTeam1: string,
  hltvTeam2: string,
  eventTeamA: string,
  eventTeamB: string,
): MatchResult {
  // Direct order: hltv1=A, hltv2=B
  if (teamsMatch(hltvTeam1, eventTeamA) && teamsMatch(hltvTeam2, eventTeamB)) {
    return { matched: true, swapped: false };
  }

  // Swapped order: hltv1=B, hltv2=A
  if (teamsMatch(hltvTeam1, eventTeamB) && teamsMatch(hltvTeam2, eventTeamA)) {
    return { matched: true, swapped: true };
  }

  return { matched: false, swapped: false };
}

/**
 * Check if two dates are within a given window (default 3 hours).
 */
export function datesClose(
  dateA: Date | number,
  dateB: Date | number,
  windowMs = 3 * 60 * 60 * 1000,
): boolean {
  const a = typeof dateA === 'number' ? dateA : dateA.getTime();
  const b = typeof dateB === 'number' ? dateB : dateB.getTime();
  return Math.abs(a - b) <= windowMs;
}
