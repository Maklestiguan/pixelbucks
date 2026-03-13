import api from "./client";

export interface FeedbackEntry {
  id: string;
  text: string;
  createdAt: string;
  user?: { id: string; username: string };
}

export async function submitFeedback(text: string): Promise<FeedbackEntry> {
  const { data } = await api.post<FeedbackEntry>("/feedback", { text });
  return data;
}

export async function getMyFeedback(): Promise<FeedbackEntry[]> {
  const { data } = await api.get<FeedbackEntry[]>("/feedback/my");
  return data;
}
