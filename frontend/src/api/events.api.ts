import api from "./client";
import type { Event } from "../types";

interface EventsResponse {
  data: Event[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getEvents(params?: {
  game?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<EventsResponse> {
  const { data } = await api.get<EventsResponse>("/events", { params });
  return data;
}

export async function getEvent(id: string): Promise<Event> {
  const { data } = await api.get<Event>(`/events/${id}`);
  return data;
}
