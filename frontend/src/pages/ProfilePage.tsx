import { useState, useEffect } from "react";
import { useAuthContext } from "../context/AuthContext";
import { getUserStats, updateMe, getBalanceHistory } from "../api/users.api";
import type { UserStats, BalanceAuditEntry } from "../types";

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

const REASON_LABELS: Record<string, string> = {
  bet_placed: "Bet Placed",
  bet_won: "Bet Won",
  bet_refund: "Bet Refund",
  admin_adjust: "Admin Adjust",
  replenish: "Weekly Top-up",
  challenge_reward: "Challenge Reward",
};

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export function ProfilePage() {
  const { user, refreshUser } = useAuthContext();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [history, setHistory] = useState<BalanceAuditEntry[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserStats(user.id)
      .then(setStats)
      .finally(() => setStatsLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setHistoryLoading(true);
    getBalanceHistory(historyPage)
      .then((res) => {
        setHistory(res.data);
        setHistoryTotalPages(res.totalPages);
      })
      .finally(() => setHistoryLoading(false));
  }, [user, historyPage]);

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

      <h2 className="text-lg font-semibold mb-3 mt-6">Balance History</h2>
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        {historyLoading ? (
          <p className="text-gray-400 p-4">Loading...</p>
        ) : history.length === 0 ? (
          <p className="text-gray-400 p-4">No balance changes yet.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-800">
                  <th className="p-3">Date</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-gray-800/50">
                    <td className="p-3 text-gray-400 text-xs">
                      {new Date(h.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">
                      {REASON_LABELS[h.reason] || h.reason}
                      {h.note && (
                        <span className="text-gray-500 ml-1">({h.note})</span>
                      )}
                    </td>
                    <td
                      className={`p-3 text-right font-mono ${
                        h.amount >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {h.amount >= 0 ? "+" : ""}
                      {formatCents(h.amount)} PB
                    </td>
                    <td className="p-3 text-right font-mono text-gray-300">
                      {formatCents(h.balanceAfter)} PB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {historyTotalPages > 1 && (
              <div className="flex justify-center gap-2 p-3">
                <button
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPage <= 1}
                  className="px-3 py-1 rounded bg-gray-800 text-sm disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-sm text-gray-400 py-1">
                  {historyPage} / {historyTotalPages}
                </span>
                <button
                  onClick={() =>
                    setHistoryPage((p) => Math.min(historyTotalPages, p + 1))
                  }
                  disabled={historyPage >= historyTotalPages}
                  className="px-3 py-1 rounded bg-gray-800 text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
