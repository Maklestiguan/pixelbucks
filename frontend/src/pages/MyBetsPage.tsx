import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getMyBets } from "../api/bets.api";
import type { Bet } from "../types";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "WON", label: "Won" },
  { key: "LOST", label: "Lost" },
  { key: "CANCELLED", label: "Cancelled" },
];

function formatBalance(cents: number) {
  return (cents / 100).toFixed(2);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    PENDING: "bg-blue-900/50 text-blue-300",
    WON: "bg-green-900/50 text-green-300",
    LOST: "bg-red-900/50 text-red-300",
    CANCELLED: "bg-yellow-900/50 text-yellow-300",
  };
  return styles[status] || "bg-gray-800 text-gray-400";
}

export function MyBetsPage() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    getMyBets({
      status: statusFilter || undefined,
      page,
      limit: 20,
    })
      .then((res) => {
        setBets(res.data);
        setTotalPages(res.totalPages);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">My Bets</h1>

      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 mb-4 inline-flex">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setStatusFilter(tab.key);
              setPage(1);
            }}
            className={`px-3 py-1 rounded text-sm ${
              statusFilter === tab.key
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400">Loading bets...</p>
      ) : bets.length === 0 ? (
        <p className="text-gray-400">No bets found.</p>
      ) : (
        <div className="space-y-3">
          {bets.map((bet) => (
            <div key={bet.id} className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${statusBadge(bet.status)}`}
                  >
                    {bet.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(bet.createdAt)}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">
                    Stake: {formatBalance(bet.amount)} PB
                  </div>
                  {bet.status === "WON" && bet.payout && (
                    <div className="font-mono text-sm text-green-400">
                      Won: +{formatBalance(bet.payout - bet.amount)} PB
                    </div>
                  )}
                  {bet.status === "PENDING" && (
                    <div className="font-mono text-xs text-gray-500">
                      Potential:{" "}
                      {formatBalance(
                        Math.floor(bet.amount * bet.oddsAtPlacement),
                      )}{" "}
                      PB
                    </div>
                  )}
                </div>
              </div>

              {bet.event && (
                <Link
                  to={`/events/${bet.event.id}`}
                  className="text-sm text-gray-400 hover:text-purple-300"
                >
                  {bet.event.teamA} vs {bet.event.teamB}
                  <span className="mx-2">|</span>
                  Picked:{" "}
                  <span className="text-white">
                    {bet.selection === "a" ? bet.event.teamA : bet.event.teamB}
                  </span>
                  <span className="mx-2">@</span>
                  <span className="font-mono">
                    {bet.oddsAtPlacement.toFixed(2)}
                  </span>
                </Link>
              )}
            </div>
          ))}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-gray-800 rounded text-sm disabled:opacity-50"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-sm text-gray-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-gray-800 rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
