import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getPublicSettings } from "../api/settings.api";
import type { AppSettings } from "../api/admin.api";

interface SettingsContextValue {
  settings: AppSettings;
  refetch: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  cs2AllowBetsWithoutHltv: false,
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const refetch = useCallback(async () => {
    try {
      const next = await getPublicSettings();
      setSettings(next);
    } catch {
      // Fall back to defaults — gate stays closed.
      setSettings(DEFAULT_SETTINGS);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <SettingsContext.Provider value={{ settings, refetch }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettingsContext must be used within SettingsProvider");
  }
  return ctx;
}
