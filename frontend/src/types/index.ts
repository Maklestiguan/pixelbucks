export interface User {
  id: string;
  username: string;
  role: "USER" | "ADMIN";
  balance: string;
  statsPublic: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: Pick<User, "id" | "username" | "role">;
}

export interface EventStream {
  language: "en" | "ru";
  embedUrl: string;
  rawUrl: string;
  official: boolean;
  main: boolean;
}

export interface Event {
  id: string;
  pandascoreId: number;
  hltvId: number | null;
  game: "dota2" | "cs2";
  tournament: string;
  league: string | null;
  teamA: string;
  teamALogo: string | null;
  teamB: string;
  teamBLogo: string | null;
  scheduledAt: string;
  status: "UPCOMING" | "LIVE" | "FINISHED" | "CANCELLED";
  oddsA: number | null;
  oddsB: number | null;
  winnerId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  bestOf: number | null;
  maxBet: number;
  bettingOpenUntil: string | null;
  streams: EventStream[];
}

export interface Bet {
  id: string;
  eventId: string;
  amount: number;
  selection: "a" | "b";
  oddsAtPlacement: number;
  status: "PENDING" | "WON" | "LOST" | "CANCELLED";
  payout: number | null;
  createdAt: string;
  event?: Event;
}

export interface UserStats {
  userId: string;
  username: string;
  totalBets: number;
  wins: number;
  winPercent: number;
  roiNet: string;
  roiPercent: number;
  totalProfit: string;
}

export interface UserChallengeView {
  id: string;
  challengeId: string;
  type: "DAILY" | "WEEKLY";
  title: string;
  description: string;
  reward: number;
  criteria: { action: string; count: number };
  progress: number;
  status: "ACTIVE" | "COMPLETED" | "EXPIRED";
  completedAt: string | null;
  expiresAt: string;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  totalProfit: string;
  totalBets: number;
}

export interface AdminUser {
  id: string;
  username: string;
  role: "USER" | "ADMIN";
  balance: string;
  totalProfit: string;
  statsPublic: boolean;
  createdAt: string;
}

export interface AdminUserDetails extends AdminUser {
  totalBets: number;
}

export interface PlatformStats {
  totalUsers: number;
  totalBets: number;
  totalVolume: string;
  activeEvents: number;
  totalCirculation: string;
}

export interface BalanceAuditEntry {
  id: string;
  userId: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
  user?: { id: string; username: string };
  reference?: {
    refType: "bet" | "challenge";
    amount?: number;
    selection?: string;
    oddsAtPlacement?: number;
    status?: string;
    payout?: number | null;
    event?: { id: string; teamA: string; teamB: string; game: string };
    title?: string;
    reward?: number;
  } | null;
}

export interface FeedbackEntry {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  user?: { id: string; username: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
