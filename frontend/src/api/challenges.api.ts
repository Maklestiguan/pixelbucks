import api from "./client";
import type { UserChallengeView } from "../types";

export async function getActiveChallenges(): Promise<UserChallengeView[]> {
  const { data } = await api.get<UserChallengeView[]>("/challenges");
  return data;
}
