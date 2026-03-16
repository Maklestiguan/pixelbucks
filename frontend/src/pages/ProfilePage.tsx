import { useState, useEffect } from "react";
import { useAuthContext } from "../context/AuthContext";
import { getUserStats, updateMe } from "../api/users.api";
import type { UserStats } from "../types";

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-mono font-bold ${color || "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { user, refreshUser } = useAuthContext();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getUserStats(user.id)
      .then(setStats)
      .finally(() => setStatsLoading(false));
  }, [user]);

  const togglePrivacy = async () => {
    if (!user) return;
    await updateMe({ statsPublic: !user.statsPublic });
    await refreshUser();
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Profile</h1>

      <div className="bg-gray-900 p-6 rounded-lg mb-4">
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-400">Username</span>
            <span>{user.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Balance</span>
            <span className="text-purple-400 font-mono">
              {user.balance} PB
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Role</span>
            <span>{user.role}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Stats visibility</span>
            <button
              onClick={togglePrivacy}
              className={`text-sm px-3 py-1 rounded ${
                user.statsPublic
                  ? "bg-green-900/30 text-green-400 border border-green-800"
                  : "bg-gray-800 text-gray-400 border border-gray-700"
              }`}
            >
              {user.statsPublic ? "Public" : "Private"}
            </button>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">My Stats (90d)</h2>
      <div className="bg-gray-900 p-6 rounded-lg">
        {statsLoading ? (
          <p className="text-gray-400">Loading stats...</p>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-4">
            <StatBox
              label="Total Bets (90d)"
              value={String(stats.totalBets)}
            />
            <StatBox label="Wins" value={String(stats.wins)} />
            <StatBox
              label="Win Rate"
              value={`${stats.winPercent.toFixed(1)}%`}
            />
            <StatBox
              label="ROI (90d)"
              value={`${stats.roiNet} PB`}
              color={
                parseFloat(stats.roiNet) >= 0
                  ? "text-green-400"
                  : "text-red-400"
              }
            />
            <StatBox
              label="ROI %"
              value={`${stats.roiPercent.toFixed(1)}%`}
              color={
                stats.roiPercent >= 0 ? "text-green-400" : "text-red-400"
              }
            />
            <StatBox
              label="All-Time P/L"
              value={`${stats.totalProfit} PB`}
              color={
                parseFloat(stats.totalProfit) >= 0
                  ? "text-green-400"
                  : "text-red-400"
              }
            />
          </div>
        ) : (
          <p className="text-gray-400">Could not load stats.</p>
        )}
      </div>
    </div>
  );
}
