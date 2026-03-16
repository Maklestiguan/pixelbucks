import { useState, useEffect, useCallback } from "react";
import { useAuthContext } from "../context/AuthContext";
import * as adminApi from "../api/admin.api";
import type { PlatformStats, AdminUser, PaginatedResponse } from "../types";

type Tab = "stats" | "users";

export function AdminPage() {
  const { user } = useAuthContext();
  const [tab, setTab] = useState<Tab>("stats");

  if (user?.role !== "ADMIN") {
    return <p className="text-red-400">Access denied.</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>
      <div className="flex gap-2 mb-6">
        {(["stats", "users"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-sm font-medium ${
              tab === t
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {t === "stats" ? "Platform Stats" : "Users"}
          </button>
        ))}
      </div>

      {tab === "stats" && <StatsTab />}
      {tab === "users" && <UsersTab />}
    </div>
  );
}

function StatsTab() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .getStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400">Loading stats...</p>;
  if (!stats) return <p className="text-red-400">Failed to load stats.</p>;

  const cards = [
    { label: "Total Users", value: stats.totalUsers },
    { label: "Total Bets", value: stats.totalBets },
    { label: "Total Volume", value: `${stats.totalVolume} PB` },
    { label: "Active Events", value: stats.activeEvents },
    { label: "PB in Circulation", value: `${stats.totalCirculation} PB` },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-gray-900 rounded-lg p-4">
          <div className="text-sm text-gray-400">{c.label}</div>
          <div className="text-xl font-bold mt-1">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function UsersTab() {
  const [data, setData] = useState<PaginatedResponse<AdminUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    adminApi
      .getUsers({ page, limit: 20, search: search || undefined })
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div>
      <input
        type="text"
        placeholder="Search by username..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="w-full max-w-sm bg-gray-800 text-white px-4 py-2 rounded border border-gray-700 focus:border-purple-500 focus:outline-none mb-4"
      />

      {loading && <p className="text-gray-400">Loading...</p>}

      {data && (
        <>
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left px-4 py-2">Username</th>
                  <th className="text-left px-4 py-2">Role</th>
                  <th className="text-right px-4 py-2">Balance</th>
                  <th className="text-right px-4 py-2">Profit</th>
                  <th className="text-right px-4 py-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    expanded={expandedId === u.id}
                    onToggle={() =>
                      setExpandedId(expandedId === u.id ? null : u.id)
                    }
                    onBalanceChanged={fetchUsers}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {data.totalPages > 1 && (
            <div className="flex gap-2 mt-4 justify-center">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 rounded bg-gray-800 text-gray-400 hover:text-white disabled:opacity-50"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-gray-400">
                {page} / {data.totalPages}
              </span>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 rounded bg-gray-800 text-gray-400 hover:text-white disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UserRow({
  user,
  expanded,
  onToggle,
  onBalanceChanged,
}: {
  user: AdminUser;
  expanded: boolean;
  onToggle: () => void;
  onBalanceChanged: () => void;
}) {
  const [amountStr, setAmountStr] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleAdjust = async () => {
    const amount = Math.round(parseFloat(amountStr || "0") * 100);
    if (amount === 0) return;
    setSaving(true);
    setMsg("");
    try {
      await adminApi.adjustBalance(user.id, {
        amount,
        reason: reason || undefined,
      });
      setMsg("Done");
      setAmountStr("");
      setReason("");
      onBalanceChanged();
      setTimeout(() => setMsg(""), 2000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setMsg(axiosErr.response?.data?.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-gray-800 cursor-pointer hover:bg-gray-800/50"
      >
        <td className="px-4 py-2 font-medium">{user.username}</td>
        <td className="px-4 py-2">
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              user.role === "ADMIN"
                ? "bg-yellow-900/50 text-yellow-400"
                : "bg-gray-700 text-gray-300"
            }`}
          >
            {user.role}
          </span>
        </td>
        <td className="px-4 py-2 text-right font-mono">{user.balance} PB</td>
        <td
          className={`px-4 py-2 text-right font-mono ${
            parseFloat(user.totalProfit) >= 0
              ? "text-green-400"
              : "text-red-400"
          }`}
        >
          {user.totalProfit} PB
        </td>
        <td className="px-4 py-2 text-right text-gray-400">
          {new Date(user.createdAt).toLocaleDateString()}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-gray-800">
          <td colSpan={5} className="px-4 py-3 bg-gray-800/30">
            <div className="flex items-end gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Amount (PB, negative to debit)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="e.g. 100 or -50"
                  className="bg-gray-800 text-white px-3 py-1.5 rounded border border-gray-700 focus:border-purple-500 focus:outline-none font-mono text-sm w-36"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400 block mb-1">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason..."
                  className="w-full bg-gray-800 text-white px-3 py-1.5 rounded border border-gray-700 focus:border-purple-500 focus:outline-none text-sm"
                />
              </div>
              <button
                onClick={handleAdjust}
                disabled={saving}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
              >
                {saving ? "..." : "Adjust"}
              </button>
              {msg && (
                <span
                  className={`text-sm ${msg === "Done" ? "text-green-400" : "text-red-400"}`}
                >
                  {msg}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
