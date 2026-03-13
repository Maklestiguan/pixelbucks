import api from "./client";
import type { User, UserStats, LeaderboardEntry } from "../types";

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
