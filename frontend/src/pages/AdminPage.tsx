import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthContext } from "../context/AuthContext";
import { useSettingsContext } from "../context/SettingsContext";
import * as adminApi from "../api/admin.api";
import type {
  PlatformStats,
  AdminUser,
  PaginatedResponse,
  BalanceAuditEntry,
  FeedbackEntry,
} from "../types";
import type { JobScheduleEntry } from "../api/admin.api";

type Tab = "stats" | "users" | "audit" | "feedback" | "jobs" | "settings";

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
        {(["stats", "users", "audit", "feedback", "jobs", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-sm font-medium capitalize ${
              tab === t
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {t === "stats"
              ? "Platform Stats"
              : t === "audit"
                ? "Balance Audit"
                : t === "jobs"
                  ? "Job Schedules"
                  : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "stats" && <StatsTab />}
      {tab === "users" && <UsersTab />}
      {tab === "audit" && <AuditTab />}
      {tab === "feedback" && <FeedbackTab />}
      {tab === "jobs" && <JobsTab />}
      {tab === "settings" && <SettingsTab />}
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

function UserAutocomplete({
  value,
  onChange,
}: {
  value: string;
  onChange: (userId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AdminUser[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      adminApi
        .getUsers({ search: query, limit: 10 })
        .then((res) => {
          setSuggestions(res.data);
          setOpen(true);
        })
        .catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (user: AdminUser) => {
    setSelectedName(user.username);
    setQuery(user.username);
    onChange(user.id);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    setSelectedName("");
    onChange("");
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className="relative w-64">
      <div className="flex">
        <input
          type="text"
          placeholder="Search user..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selectedName) {
              setSelectedName("");
              onChange("");
            }
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          className="bg-gray-800 text-white px-3 py-2 rounded-l border border-gray-700 focus:border-purple-500 focus:outline-none text-sm flex-1"
        />
        {value && (
          <button
            onClick={handleClear}
            className="bg-gray-700 text-gray-400 hover:text-white px-2 rounded-r border border-l-0 border-gray-700 text-sm"
          >
            ✕
          </button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((u) => (
            <li
              key={u.id}
              onClick={() => handleSelect(u)}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-700 ${
                u.id === value ? "bg-gray-700 text-purple-400" : "text-white"
              }`}
            >
              <span className="font-medium">{u.username}</span>
              <span className="text-gray-400 ml-2 text-xs">
                {u.balance} PB
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AuditDetails({ entry }: { entry: BalanceAuditEntry }) {
  const ref = entry.reference;

  if (ref?.refType === "bet" && ref.event) {
    const picked =
      ref.selection === "a" ? ref.event.teamA : ref.event.teamB;
    return (
      <div className="space-y-0.5">
        <div className="text-gray-300">
          <span className="text-gray-500">{ref.event.game.toUpperCase()}</span>{" "}
          {ref.event.teamA} vs {ref.event.teamB}
        </div>
        <div className="text-gray-400">
          Picked <span className="text-white font-medium">{picked}</span> @{" "}
          <span className="font-mono">{ref.oddsAtPlacement?.toFixed(2)}</span>
          {" · "}
          <span
            className={
              ref.status === "WON"
                ? "text-green-400"
                : ref.status === "LOST"
                  ? "text-red-400"
                  : "text-yellow-400"
            }
          >
            {ref.status}
          </span>
          {ref.payout != null && (
            <span className="text-gray-500">
              {" "}
              (payout: {formatCents(ref.payout)} PB)
            </span>
          )}
        </div>
      </div>
    );
  }

  if (ref?.refType === "challenge") {
    return (
      <div className="text-gray-300">
        <span className="font-medium">{ref.title}</span>
        {ref.reward != null && (
          <span className="text-gray-500">
            {" "}
            (+{formatCents(ref.reward)} PB)
          </span>
        )}
      </div>
    );
  }

  return <span className="text-gray-400">{entry.note || ""}</span>;
}

function AuditTab() {
  const [data, setData] = useState<PaginatedResponse<BalanceAuditEntry> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [userFilter, setUserFilter] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");

  const fetch = useCallback(() => {
    setLoading(true);
    adminApi
      .getBalanceAudit({
        page,
        userId: userFilter || undefined,
        reason: reasonFilter || undefined,
      })
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, userFilter, reasonFilter]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <UserAutocomplete
          value={userFilter}
          onChange={(userId) => {
            setUserFilter(userId);
            setPage(1);
          }}
        />
        <select
          value={reasonFilter}
          onChange={(e) => {
            setReasonFilter(e.target.value);
            setPage(1);
          }}
          className="bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:border-purple-500 focus:outline-none text-sm"
        >
          <option value="">All reasons</option>
          {Object.entries(REASON_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-gray-400">Loading...</p>}

      {data && (
        <>
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-800">
                  <th className="p-3">Date</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-right">Balance After</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((h) => (
                  <tr
                    key={h.id}
                    className="border-b border-gray-800/50"
                  >
                    <td className="p-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(h.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">{h.user?.username || h.userId}</td>
                    <td className="p-3">
                      {REASON_LABELS[h.reason] || h.reason}
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
                    <td className="p-3 text-xs">
                      <AuditDetails entry={h} />
                    </td>
                  </tr>
                ))}
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-gray-400 text-center">
                      No audit records found.
                    </td>
                  </tr>
                )}
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

function formatInterval(ms: number) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatTimeAgo(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  if (diff < 1000) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatTimeUntil(isoDate: string) {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return "now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `in ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `in ${minutes}m ${seconds % 60}s`;
  return `in ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function JobsTab() {
  const [jobs, setJobs] = useState<JobScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const fetchJobs = useCallback(() => {
    adminApi
      .getJobSchedules()
      .then(setJobs)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  // Re-render every 10s to update "time until" countdowns
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p className="text-gray-400">Loading job schedules...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">
          Auto-refreshes every 30s
        </p>
        <button
          onClick={() => { setLoading(true); fetchJobs(); }}
          className="px-3 py-1 rounded bg-gray-800 text-gray-400 hover:text-white text-sm"
        >
          Refresh
        </button>
      </div>
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left border-b border-gray-800">
              <th className="p-3">Job</th>
              <th className="p-3">Queue</th>
              <th className="p-3">Status</th>
              <th className="p-3">Interval</th>
              <th className="p-3">Last Run</th>
              <th className="p-3">Next Run</th>
              <th className="p-3">Countdown</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job, i) => (
              <tr key={`${job.queue}-${i}`} className="border-b border-gray-800/50">
                <td className="p-3 font-medium">
                  {job.label}
                  {job.jobName && (
                    <span className="text-gray-500 text-xs ml-1.5">({job.jobName})</span>
                  )}
                </td>
                <td className="p-3 text-gray-400 font-mono text-xs">{job.queue}</td>
                <td className="p-3">
                  {job.isRunning ? (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-400">running</span>
                  ) : job.next ? (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/50 text-green-400">scheduled</span>
                  ) : (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">inactive</span>
                  )}
                </td>
                <td className="p-3 font-mono">
                  {job.interval
                    ? formatInterval(job.interval)
                    : job.cron || "—"}
                </td>
                <td className="p-3 text-xs whitespace-nowrap">
                  {job.lastRun ? (
                    <span className="text-gray-300" title={new Date(job.lastRun).toLocaleString()}>
                      {formatTimeAgo(job.lastRun)}
                    </span>
                  ) : (
                    <span className="text-gray-500">never</span>
                  )}
                </td>
                <td className="p-3 text-gray-300 text-xs whitespace-nowrap">
                  {job.next
                    ? new Date(job.next).toLocaleTimeString()
                    : "—"}
                </td>
                <td className="p-3">
                  {job.next ? (
                    <span className={
                      new Date(job.next).getTime() - Date.now() <= 0
                        ? "text-green-400"
                        : "text-yellow-400"
                    }>
                      {formatTimeUntil(job.next)}
                    </span>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-gray-400 text-center">
                  No job schedules found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeedbackTab() {
  const [data, setData] = useState<PaginatedResponse<FeedbackEntry> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    adminApi
      .getFeedback({ page })
      .then(setData)
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      {loading && <p className="text-gray-400">Loading...</p>}

      {data && (
        <>
          <div className="space-y-3">
            {data.data.map((f) => (
              <div key={f.id} className="bg-gray-900 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium">
                    {f.user?.username || f.userId}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(f.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-gray-300 text-sm">{f.text}</p>
              </div>
            ))}
            {data.data.length === 0 && (
              <p className="text-gray-400">No feedback yet.</p>
            )}
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

function SettingsTab() {
  const { settings, refetch } = useSettingsContext();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    setMsg("");
    try {
      await adminApi.updateAdminSettings({ cs2AllowBetsWithoutHltv: next });
      await refetch();
      setMsg("Saved");
      setTimeout(() => setMsg(""), 2000);
    } catch {
      setMsg("Failed to save");
      setTimeout(() => setMsg(""), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6 max-w-2xl">
      <h2 className="text-lg font-bold mb-4">Platform Settings</h2>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.cs2AllowBetsWithoutHltv}
          disabled={saving}
          onChange={(e) => handleToggle(e.target.checked)}
          className="mt-1 w-4 h-4 accent-purple-600"
        />
        <div>
          <div className="text-sm font-medium text-white">
            Allow CS2 bets without HLTV odds
          </div>
          <p className="text-xs text-gray-400 mt-1">
            When enabled, users can place bets on CS2 events even if HLTV
            mapping hasn&apos;t run yet. Bets use whatever odds are currently
            on the event (default 1.86 / 1.86 unless an admin has edited
            them per event).
          </p>
        </div>
      </label>

      {msg && (
        <p
          className={`text-xs mt-3 ${msg === "Saved" ? "text-green-400" : "text-red-400"}`}
        >
          {msg}
        </p>
      )}
    </div>
  );
}
