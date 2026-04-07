import api from "./client";
import type {
  Event,
  AdminUser,
  AdminUserDetails,
  PlatformStats,
  PaginatedResponse,
  BalanceAuditEntry,
  FeedbackEntry,
} from "../types";

export async function updateEvent(
  id: string,
  data: { oddsA?: number; oddsB?: number; maxBet?: number; status?: string; bettingOpenMinutes?: number; hltvId?: number },
): Promise<Event> {
  const { data: event } = await api.patch<Event>(`/admin/events/${id}`, data);
  return event;
}

export async function getUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedResponse<AdminUser>> {
  const { data } = await api.get<PaginatedResponse<AdminUser>>(
    "/admin/users",
    { params },
  );
  return data;
}

export async function getUser(id: string): Promise<AdminUserDetails> {
  const { data } = await api.get<AdminUserDetails>(`/admin/users/${id}`);
  return data;
}

export async function adjustBalance(
  userId: string,
  body: { amount: number; reason?: string },
): Promise<{ id: string; username: string; balance: string }> {
  const { data } = await api.patch(`/admin/users/${userId}/balance`, body);
  return data;
}

export async function getStats(): Promise<PlatformStats> {
  const { data } = await api.get<PlatformStats>("/admin/stats");
  return data;
}

export async function getBalanceAudit(params?: {
  page?: number;
  limit?: number;
  userId?: string;
  reason?: string;
}): Promise<PaginatedResponse<BalanceAuditEntry>> {
  const { data } = await api.get<PaginatedResponse<BalanceAuditEntry>>(
    "/admin/balance-audit",
    { params },
  );
  return data;
}

export interface JobScheduleEntry {
  queue: string;
  label: string;
  jobName: string | null;
  interval: number | null;
  cron: string | null;
  next: string | null;
  lastRun: string | null;
  lastRunName: string | null;
  isRunning: boolean;
}

export async function getJobSchedules(): Promise<JobScheduleEntry[]> {
  const { data } = await api.get<JobScheduleEntry[]>("/admin/jobs");
  return data;
}

export async function getFeedback(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<FeedbackEntry>> {
  const { data } = await api.get<PaginatedResponse<FeedbackEntry>>(
    "/admin/feedback",
    { params },
  );
  return data;
}

export interface AdminTournament {
  id: string;
  pandascoreId: number;
  name: string;
  tier: string;
  game: "cs2" | "dota2";
  hltvEventId: number | null;
  endAt: string | null;
  createdAt: string;
  eventsCount: number;
}

export async function getTournaments(params?: {
  page?: number;
  limit?: number;
  game?: "cs2" | "dota2";
  search?: string;
}): Promise<PaginatedResponse<AdminTournament>> {
  const { data } = await api.get<PaginatedResponse<AdminTournament>>(
    "/admin/tournaments",
    { params },
  );
  return data;
}

export async function updateTournament(
  id: string,
  body: { hltvEventId?: number | null; endAt?: string | null },
): Promise<AdminTournament> {
  const { data } = await api.patch<AdminTournament>(
    `/admin/tournaments/${id}`,
    body,
  );
  return data;
}

export interface AppSettings {
  cs2AllowBetsWithoutHltv: boolean;
}

export async function getAdminSettings(): Promise<AppSettings> {
  const { data } = await api.get<AppSettings>("/admin/settings");
  return data;
}

export async function updateAdminSettings(
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  const { data } = await api.patch<AppSettings>("/admin/settings", patch);
  return data;
}
