import api from "./client";
import type { AuthResponse } from "../types";

export async function register(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/register", {
    username,
    password,
  });
  return data;
}

export async function login(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/login", {
    username,
    password,
  });
  return data;
}
