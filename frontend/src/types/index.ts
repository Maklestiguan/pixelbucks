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

export interface Event {
  id: string;
  pandascoreId: number;
  game: "dota2" | "cs2";
  tournament: string;
  teamA: string;
  teamALogo: string | null;
  teamB: string;
  teamBLogo: string | null;
  scheduledAt: string;
  status: "UPCOMING" | "LIVE" | "FINISHED" | "CANCELLED";
  oddsA: number | null;
  oddsB: number | null;
  winnerId: string | null;
  maxBet: number;
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
}
