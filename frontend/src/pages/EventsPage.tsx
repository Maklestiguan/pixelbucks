import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getEvents } from "../api/events.api";
import type { Event } from "../types";

const GAME_TABS = [
  { key: "", label: "All" },
  { key: "dota2", label: "Dota 2" },
  { key: "cs2", label: "CS2" },
];

const STATUS_TABS = [
  { key: "UPCOMING", label: "Upcoming" },
  { key: "FINISHED", label: "Finished" },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBalance(cents: number) {
  return (cents / 100).toFixed(2);
}

export function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState("");
  const [status, setStatus] = useState("UPCOMING");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    getEvents({
      game: game || undefined,
      status: status || undefined,
      page,
      limit: 20,
    })
      .then((res) => {
        setEvents(res.data);
        setTotalPages(res.totalPages);
      })
      .finally(() => setLoading(false));
  }, [game, status, page]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Events</h1>

      <div className="flex gap-4 mb-4">
        <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
          {GAME_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setGame(tab.key);
                setPage(1);
              }}
              className={`px-3 py-1 rounded text-sm ${
                game === tab.key
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setStatus(tab.key);
                setPage(1);
              }}
              className={`px-3 py-1 rounded text-sm ${
                status === tab.key
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading events...</p>
      ) : events.length === 0 ? (
        <p className="text-gray-400">No events found.</p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="block bg-gray-900 rounded-lg p-4 hover:bg-gray-800 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        event.game === "dota2"
                          ? "bg-red-900/50 text-red-300"
                          : "bg-yellow-900/50 text-yellow-300"
                      }`}
                    >
                      {event.game === "dota2" ? "Dota 2" : "CS2"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {event.tournament}
                    </span>
                    <span className="text-xs text-gray-600">
                      {formatDate(event.scheduledAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      {event.teamALogo && (
                        <img
                          src={event.teamALogo}
                          alt=""
                          className="w-6 h-6 rounded"
                        />
                      )}
                      <span className="font-medium">{event.teamA}</span>
                    </div>
                    <span className="text-gray-500 text-sm">vs</span>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span className="font-medium">{event.teamB}</span>
                      {event.teamBLogo && (
                        <img
                          src={event.teamBLogo}
                          alt=""
                          className="w-6 h-6 rounded"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  {event.status === "UPCOMING" && event.oddsA && event.oddsB ? (
                    <>
                      <div className="bg-gray-800 px-3 py-1 rounded text-center min-w-[60px]">
                        <div className="text-xs text-gray-500">1</div>
                        <div className="font-mono text-sm text-purple-400">
                          {event.oddsA.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-gray-800 px-3 py-1 rounded text-center min-w-[60px]">
                        <div className="text-xs text-gray-500">2</div>
                        <div className="font-mono text-sm text-purple-400">
                          {event.oddsB.toFixed(2)}
                        </div>
                      </div>
                    </>
                  ) : event.status === "FINISHED" ? (
                    <div className="text-sm text-gray-400">
                      {event.winnerId === "a" ? event.teamA : event.teamB} won
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">{event.status}</div>
                  )}
                </div>
              </div>

              {event.status === "UPCOMING" && (
                <div className="text-xs text-gray-600 mt-2">
                  Max bet: {formatBalance(event.maxBet)} PB
                </div>
              )}
            </Link>
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
