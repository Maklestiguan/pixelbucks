import { useState, useCallback, useEffect } from "react";
import type { User } from "../types";
import * as authApi from "../api/auth.api";
import * as usersApi from "../api/users.api";

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem("token");
    return {
      token,
      user: null,
      isAuthenticated: !!token,
      isLoading: !!token,
    };
  });

  useEffect(() => {
    if (state.token && !state.user) {
      usersApi
        .getMe()
        .then((user) => setState((s) => ({ ...s, user, isLoading: false })))
        .catch(() => {
          localStorage.removeItem("token");
          setState({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        });
    }
  }, [state.token, state.user]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login(username, password);
    localStorage.setItem("token", res.accessToken);
    const user = await usersApi.getMe();
    setState({
      token: res.accessToken,
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const res = await authApi.register(username, password);
    localStorage.setItem("token", res.accessToken);
    const user = await usersApi.getMe();
    setState({
      token: res.accessToken,
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setState({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const refreshUser = useCallback(async () => {
    const user = await usersApi.getMe();
    setState((s) => ({ ...s, user }));
  }, []);

  return { ...state, login, register, logout, refreshUser };
}
