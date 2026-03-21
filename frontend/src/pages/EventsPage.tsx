import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { getEvents } from "../api/events.api";
import { placeBet } from "../api/bets.api";
import { updateEvent } from "../api/admin.api";
import { useAuthContext } from "../context/AuthContext";
import type { Event, EventStream } from "../types";

const GAME_TABS = [
  { key: "", label: "All" },
  { key: "dota2", label: "Dota 2" },
  { key: "cs2", label: "CS2" },
];

const STATUS_TABS = [
  { key: "UPCOMING", label: "Upcoming" },
  { key: "LIVE", label: "Live" },
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

function BettingCountdown({ until }: { until: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(until).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Closed");
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [until]);

  if (remaining === "Closed") return null;

  return (
    <span className="text-xs font-mono text-green-400">{remaining}</span>
  );
}

function getStreamLabel(stream: EventStream) {
  const lang = stream.language.toUpperCase();
  const platform = stream.rawUrl.includes("twitch.tv")
    ? "Twitch"
    : stream.rawUrl.includes("youtube.com") || stream.rawUrl.includes("youtu.be")
      ? "YouTube"
      : stream.rawUrl.includes("kick.com")
        ? "Kick"
        : "Stream";
  const channel = stream.rawUrl.split("/").pop() || platform;
  return `${lang} — ${channel} (${platform})${stream.official ? " *" : ""}`;
}

function buildEmbedUrl(stream: EventStream) {
  let url = stream.embedUrl;
  if (url.includes("player.twitch.tv")) {
    const sep = url.includes("?") ? "&" : "?";
    url += `${sep}parent=${window.location.hostname}&autoplay=true&muted=false`;
  }
  if (url.includes("youtube.com/embed")) {
    const sep = url.includes("?") ? "&" : "?";
    url += `${sep}autoplay=1`;
  }
  return url;
}

/* ── Top-of-page Stream Player ── */
function TopStreamPlayer({
  stream,
  matchLabel,
  onClose,
}: {
  stream: EventStream;
  matchLabel: string;
  onClose: () => void;
}) {
  const [iframeKey, setIframeKey] = useState(0);

  // Force fresh iframe on stream change
  useEffect(() => {
    setIframeKey((k) => k + 1);
  }, [stream.embedUrl]);

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden mb-4 border border-gray-800">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50">
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white font-medium">{matchLabel}</span>
          <span className="text-gray-400">— {getStreamLabel(stream)}</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-sm px-2 py-0.5 rounded hover:bg-gray-700"
        >
          Close
        </button>
      </div>
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          key={iframeKey}
          src={buildEmbedUrl(stream)}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    </div>
  );
}

/* ── Stream Dropdown ── */
function StreamDropdown({
  streams,
  onSelect,
}: {
  streams: EventStream[];
  onSelect: (stream: EventStream) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (streams.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700 transition"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-3 h-3 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        Watch ({streams.length})
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {streams.map((stream, i) => (
            <button
              key={`${stream.embedUrl}-${i}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(stream);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-700 text-gray-300 flex items-center justify-between"
            >
              <span>{getStreamLabel(stream)}</span>
              {stream.main && (
                <span className="text-[10px] bg-purple-600 px-1.5 py-0.5 rounded text-white ml-2">
                  MAIN
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Inline Bet Slip ── */
function InlineBetSlip({
  event,
  onBetPlaced,
  canBet = true,
}: {
  event: Event;
  onBetPlaced: () => void;
  canBet?: boolean;
}) {
  const { refreshUser } = useAuthContext();
  const [selection, setSelection] = useState<"a" | "b" | null>(null);
  const [amountStr, setAmountStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const amountCents = Math.round(parseFloat(amountStr || "0") * 100);
  const selectedOdds =
    selection === "a" ? event.oddsA : selection === "b" ? event.oddsB : null;
  const potentialPayout =
    selectedOdds && amountCents > 0
      ? Math.floor(amountCents * selectedOdds)
      : 0;

  const handlePlace = async () => {
    if (!selection || amountCents <= 0) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await placeBet({
        eventId: event.id,
        selection,
        amount: amountCents,
      });
      setSuccess(
        `Bet placed! Payout: ${formatBalance(result.potentialPayout)} PB`,
      );
      setTimeout(() => setSuccess(""), 4000);
      setSelection(null);
      setAmountStr("");
      await refreshUser();
      onBetPlaced();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || "Failed to place bet");
      setTimeout(() => setError(""), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-800">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => canBet && setSelection(selection === "a" ? null : "a")}
          disabled={!canBet}
          className={`flex-1 py-1.5 rounded text-sm font-medium transition ${
            selection === "a"
              ? "bg-purple-600 text-white"
              : canBet
                ? "bg-gray-800 text-gray-400 hover:text-white"
                : "bg-gray-800/50 text-gray-500 cursor-default"
          }`}
        >
          {event.teamA}{" "}
          {event.oddsA && (
            <span className="font-mono text-xs opacity-80">
              ({event.oddsA.toFixed(2)})
            </span>
          )}
        </button>
        <button
          onClick={() => canBet && setSelection(selection === "b" ? null : "b")}
          disabled={!canBet}
          className={`flex-1 py-1.5 rounded text-sm font-medium transition ${
            selection === "b"
              ? "bg-purple-600 text-white"
              : canBet
                ? "bg-gray-800 text-gray-400 hover:text-white"
                : "bg-gray-800/50 text-gray-500 cursor-default"
          }`}
        >
          {event.teamB}{" "}
          {event.oddsB && (
            <span className="font-mono text-xs opacity-80">
              ({event.oddsB.toFixed(2)})
            </span>
          )}
        </button>
      </div>

      {selection && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Amount (PB)"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="flex-1 bg-gray-800 text-white px-3 py-1.5 rounded border border-gray-700 focus:border-purple-500 focus:outline-none text-sm"
          />
          {potentialPayout > 0 && (
            <span className="text-xs text-gray-400 whitespace-nowrap">
              Win: {formatBalance(potentialPayout)} PB
            </span>
          )}
          <button
            onClick={handlePlace}
            disabled={loading || amountCents <= 0}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? "..." : "Place Bet"}
          </button>
        </div>
      )}

      {success && (
        <p className="text-green-400 text-xs mt-1">{success}</p>
      )}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

/* ── Inline Admin Controls ── */
function InlineAdminControls({
  event,
  onUpdated,
}: {
  event: Event;
  onUpdated: (e: Event) => void;
}) {
  const [oddsA, setOddsA] = useState(String(event.oddsA ?? ""));
  const [oddsB, setOddsB] = useState(String(event.oddsB ?? ""));
  const [hltvIdStr, setHltvIdStr] = useState(String(event.hltvId ?? ""));
  const [bettingMinutes, setBettingMinutes] = useState("5");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const isBettingOpen =
    event.bettingOpenUntil && new Date(event.bettingOpenUntil) > new Date();

  const handleSaveOdds = async () => {
    setSaving(true);
    setMsg("");
    try {
      const updated = await updateEvent(event.id, {
        oddsA: parseFloat(oddsA),
        oddsB: parseFloat(oddsB),
      });
      onUpdated(updated);
      setMsg("Saved");
      setTimeout(() => setMsg(""), 2000);
    } catch {
      setMsg("Failed");
      setTimeout(() => setMsg(""), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenBetting = async () => {
    setSaving(true);
    setMsg("");
    try {
      const mins = parseInt(bettingMinutes, 10);
      if (isNaN(mins) || mins <= 0) return;
      const updated = await updateEvent(event.id, {
        bettingOpenMinutes: mins,
      });
      onUpdated(updated);
      setMsg(`Open ${mins}m`);
      setTimeout(() => setMsg(""), 3000);
    } catch {
      setMsg("Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCloseBetting = async () => {
    setSaving(true);
    try {
      const updated = await updateEvent(event.id, {
        bettingOpenMinutes: 0,
      });
      onUpdated(updated);
      setMsg("Closed");
      setTimeout(() => setMsg(""), 2000);
    } catch {
      setMsg("Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-yellow-800/30">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-yellow-500 font-bold uppercase">
          Admin
        </span>
        <input
          type="number"
          step="0.01"
          min="1.10"
          max="10"
          value={oddsA}
          onChange={(e) => setOddsA(e.target.value)}
          className="w-16 bg-gray-800 text-white px-2 py-1 rounded border border-gray-700 focus:border-yellow-500 focus:outline-none font-mono text-xs text-center"
          title={`Odds ${event.teamA}`}
        />
        <input
          type="number"
          step="0.01"
          min="1.10"
          max="10"
          value={oddsB}
          onChange={(e) => setOddsB(e.target.value)}
          className="w-16 bg-gray-800 text-white px-2 py-1 rounded border border-gray-700 focus:border-yellow-500 focus:outline-none font-mono text-xs text-center"
          title={`Odds ${event.teamB}`}
        />
        <button
          onClick={handleSaveOdds}
          disabled={saving}
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs font-medium disabled:opacity-50"
        >
          Save
        </button>

        <span className="text-gray-600">|</span>
        <input
          type="number"
          value={hltvIdStr}
          onChange={(e) => setHltvIdStr(e.target.value)}
          placeholder="HLTV ID"
          className="w-20 bg-gray-800 text-white px-2 py-1 rounded border border-gray-700 focus:border-yellow-500 focus:outline-none font-mono text-xs text-center"
          title="HLTV Match ID"
        />
        <button
          onClick={async () => {
            const id = parseInt(hltvIdStr, 10);
            if (isNaN(id) || id <= 0) return;
            setSaving(true);
            setMsg("");
            try {
              const updated = await updateEvent(event.id, { hltvId: id });
              onUpdated(updated);
              setMsg("HLTV set");
              setTimeout(() => setMsg(""), 2000);
            } catch {
              setMsg("Failed");
              setTimeout(() => setMsg(""), 3000);
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs font-medium disabled:opacity-50"
        >
          Set
        </button>
        {event.hltvId && (
          <a
            href={`https://www.hltv.org/matches/${event.hltvId}/match`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            HLTV
          </a>
        )}

        {event.status === "LIVE" && (
          <>
            <span className="text-gray-600">|</span>
            {isBettingOpen ? (
              <>
                <BettingCountdown until={event.bettingOpenUntil!} />
                <button
                  onClick={handleCloseBetting}
                  disabled={saving}
                  className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-medium disabled:opacity-50"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={bettingMinutes}
                  onChange={(e) => setBettingMinutes(e.target.value)}
                  className="w-12 bg-gray-800 text-white px-1 py-1 rounded border border-gray-700 focus:border-green-500 focus:outline-none font-mono text-xs text-center"
                />
                <span className="text-[10px] text-gray-500">min</span>
                <button
                  onClick={handleOpenBetting}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium disabled:opacity-50"
                >
                  Open Bets
                </button>
              </>
            )}
          </>
        )}

        {msg && (
          <span
            className={`text-xs ${msg === "Failed" ? "text-red-400" : "text-green-400"}`}
          >
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Event Card ── */
function EventCard({
  event: initialEvent,
  isAdmin,
  onStreamSelect,
}: {
  event: Event;
  isAdmin: boolean;
  onStreamSelect: (stream: EventStream, matchLabel: string) => void;
}) {
  const [event, setEvent] = useState(initialEvent);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setEvent(initialEvent);
  }, [initialEvent]);

  const isLiveBettingOpen =
    event.status === "LIVE" &&
    !!event.bettingOpenUntil &&
    new Date(event.bettingOpenUntil) > new Date();
  const hasRealOdds = event.game === "cs2" ? !!event.hltvId : true;
  const canBet =
    (event.status === "UPCOMING" || isLiveBettingOpen) &&
    event.oddsA != null &&
    event.oddsB != null &&
    hasRealOdds;

  const matchLabel = `${event.teamA} vs ${event.teamB}`;

  return (
    <div className="bg-gray-900 rounded-lg relative">
      {/* Main card content */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              event.game === "dota2"
                ? "bg-red-900/50 text-red-300"
                : "bg-yellow-900/50 text-yellow-300"
            }`}
          >
            {event.game === "dota2" ? "Dota 2" : "CS2"}
          </span>
          {event.league && (
            <span className="text-xs text-gray-200 font-medium">
              {event.league}
            </span>
          )}
          <span className="text-xs text-gray-400">{event.tournament}</span>
          <span className="text-xs text-gray-400">
            {formatDate(event.scheduledAt)}
          </span>
          {event.bestOf && (
            <span className="text-xs text-gray-400">BO{event.bestOf}</span>
          )}
          {event.status === "LIVE" && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-600/80 text-white font-medium animate-pulse">
              LIVE
            </span>
          )}
          {isLiveBettingOpen && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-green-600/80 text-white font-medium">
              BETS OPEN
            </span>
          )}
        </div>

        {/* Teams + scores row */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {event.teamALogo && (
              <img
                src={event.teamALogo}
                alt=""
                className="w-6 h-6 rounded shrink-0"
              />
            )}
            <span
              className={`font-semibold text-base truncate ${event.winnerId === "a" ? "text-green-400" : "text-white"}`}
            >
              {event.teamA}
            </span>
          </div>

          {event.scoreA !== null && event.scoreB !== null ? (
            <span className="font-mono font-bold text-lg shrink-0">
              <span
                className={
                  event.winnerId === "a" ? "text-green-400" : "text-gray-200"
                }
              >
                {event.scoreA}
              </span>
              <span className="text-gray-400 mx-1">:</span>
              <span
                className={
                  event.winnerId === "b" ? "text-green-400" : "text-gray-200"
                }
              >
                {event.scoreB}
              </span>
            </span>
          ) : (
            <span className="text-gray-400 text-sm font-medium shrink-0">vs</span>
          )}

          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span
              className={`font-semibold text-base truncate ${event.winnerId === "b" ? "text-green-400" : "text-white"}`}
            >
              {event.teamB}
            </span>
            {event.teamBLogo && (
              <img
                src={event.teamBLogo}
                alt=""
                className="w-6 h-6 rounded shrink-0"
              />
            )}
          </div>
        </div>

        {/* Odds display — always visible when odds exist */}
        {event.oddsA && event.oddsB && event.status !== "FINISHED" && event.status !== "CANCELLED" ? (
          <InlineBetSlip event={event} onBetPlaced={() => {}} canBet={canBet} />
        ) : !hasRealOdds &&
          event.game === "cs2" &&
          event.status !== "FINISHED" &&
          event.status !== "CANCELLED" ? (
            <p className="text-xs text-gray-500 mt-2">
              Odds pending — waiting for HLTV data
            </p>
          ) : null}

        {/* Expandable section: streams, admin, details */}
        <div className="mt-2 flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
            {expanded ? "Less" : "More"}
          </button>
          <div className="flex items-center gap-2">
            {event.streams.length > 0 && (
              <StreamDropdown
                streams={event.streams}
                onSelect={(s) => onStreamSelect(s, matchLabel)}
              />
            )}
            {event.hltvId && (
              <a
                href={`https://www.hltv.org/matches/${event.hltvId}/match`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-800 text-blue-400 hover:text-blue-300 hover:bg-gray-700 border border-gray-700 transition"
              >
                HLTV
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Expanded section — admin + details only */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-800">
          {isAdmin &&
            event.status !== "FINISHED" &&
            event.status !== "CANCELLED" && (
              <InlineAdminControls event={event} onUpdated={setEvent} />
            )}

          <div className="mt-3 pt-2 border-t border-gray-800 flex items-center justify-between">
            <Link
              to={`/events/${event.id}`}
              className="text-xs text-purple-400 hover:text-purple-300 underline"
              onClick={(e) => e.stopPropagation()}
            >
              View full details
            </Link>
            <span className="text-xs text-gray-600">
              Max bet: {formatBalance(event.maxBet)} PB
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Events Page ── */
export function EventsPage() {
  const { user } = useAuthContext();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState("");
  const [status, setStatus] = useState("UPCOMING");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Top-of-page active stream
  const [activeStream, setActiveStream] = useState<EventStream | null>(null);
  const [activeMatchLabel, setActiveMatchLabel] = useState("");

  const isAdmin = user?.role === "ADMIN";

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

  const handleStreamSelect = (stream: EventStream, matchLabel: string) => {
    setActiveStream(stream);
    setActiveMatchLabel(matchLabel);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Events</h1>

      {/* Persistent stream player at top */}
      {activeStream && (
        <TopStreamPlayer
          stream={activeStream}
          matchLabel={activeMatchLabel}
          onClose={() => setActiveStream(null)}
        />
      )}

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
            <EventCard
              key={event.id}
              event={event}
              isAdmin={isAdmin}
              onStreamSelect={handleStreamSelect}
            />
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
