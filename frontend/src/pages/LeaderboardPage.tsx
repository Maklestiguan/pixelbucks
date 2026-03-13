import { useState, useEffect } from "react";
import { useAuthContext } from "../context/AuthContext";
import { getLeaderboard } from "../api/users.api";
import type { LeaderboardEntry } from "../types";

export function LeaderboardPage() {
  const { user } = useAuthContext();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard()
      .then(setLeaderboard)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Leaderboard</h1>

      {loading ? (
        <p className="text-gray-400">Loading leaderboard...</p>
      ) : leaderboard.length === 0 ? (
        <p className="text-gray-400">No data yet.</p>
      ) : (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <div className="grid grid-cols-[40px_1fr_100px_80px] gap-2 px-4 py-2 text-xs text-gray-500 border-b border-gray-800 font-medium">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Profit</span>
            <span className="text-right">Bets</span>
          </div>
          {leaderboard.map((entry, i) => (
            <div
              key={entry.id}
              className={`grid grid-cols-[40px_1fr_100px_80px] gap-2 px-4 py-2.5 items-center ${
                entry.id === user?.id ? "bg-purple-900/20" : ""
              } ${i < leaderboard.length - 1 ? "border-b border-gray-800/50" : ""}`}
            >
              <span
                className={`text-sm font-bold ${
                  i === 0
                    ? "text-yellow-400"
                    : i === 1
                      ? "text-gray-300"
                      : i === 2
                        ? "text-amber-600"
                        : "text-gray-500"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-sm truncate ${entry.id === user?.id ? "text-purple-400 font-medium" : "text-white"}`}
              >
                {entry.username}
              </span>
              <span
                className={`text-sm font-mono text-right ${
                  parseFloat(entry.totalProfit) >= 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {entry.totalProfit}
              </span>
              <span className="text-sm text-gray-400 text-right">
                {entry.totalBets}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
