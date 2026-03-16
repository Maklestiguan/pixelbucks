import api from "./client";
import type { Bet } from "../types";

interface BetsResponse {
  data: Bet[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PlaceBetPayload {
  eventId: string;
  selection: "a" | "b";
  amount: number;
}

export async function placeBet(payload: PlaceBetPayload) {
  const { data } = await api.post("/bets", payload);
  return data;
}

export async function getMyBets(params?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<BetsResponse> {
  const { data } = await api.get<BetsResponse>("/bets/my", { params });
  return data;
}

export async function getActiveBets(): Promise<Bet[]> {
  const { data } = await api.get<Bet[]>("/bets/my/active");
  return data;
}
