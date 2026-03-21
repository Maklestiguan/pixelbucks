import api from "./client";
import type { User, UserStats, LeaderboardEntry, BalanceAuditEntry, PaginatedResponse } from "../types";

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>("/users/me");
  return data;
}

export async function updateMe(body: { statsPublic?: boolean }): Promise<User> {
  const { data } = await api.patch<User>("/users/me", body);
  return data;
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const { data } = await api.get<UserStats>(`/users/${userId}/stats`);
  return data;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data } = await api.get<LeaderboardEntry[]>("/users/leaderboard");
  return data;
}

export async function getBalanceHistory(
  page = 1,
): Promise<PaginatedResponse<BalanceAuditEntry>> {
  const { data } = await api.get<PaginatedResponse<BalanceAuditEntry>>(
    "/users/me/balance-history",
    { params: { page } },
  );
  return data;
}
