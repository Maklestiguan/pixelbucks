import api from "./client";
import type { AppSettings } from "./admin.api";

export async function getPublicSettings(): Promise<AppSettings> {
  const { data } = await api.get<AppSettings>("/settings");
  return data;
}
