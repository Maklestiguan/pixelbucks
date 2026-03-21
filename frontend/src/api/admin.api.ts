import api from "./client";
import type {
  Event,
  AdminUser,
  AdminUserDetails,
  PlatformStats,
  PaginatedResponse,
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
