import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getEvent } from "../api/events.api";
import { placeBet } from "../api/bets.api";
import { updateEvent } from "../api/admin.api";
import { useAuthContext } from "../context/AuthContext";
import { useSettingsContext } from "../context/SettingsContext";
import { useOddsUpdates } from "../hooks/useOddsUpdates";
import type { Event, EventStream } from "../types";

function AdminOddsEditor({
  event,
  onSaved,
}: {
  event: Event;
  onSaved: (e: Event) => void;
}) {
  const [oddsA, setOddsA] = useState(String(event.oddsA ?? "N/A"));
  const [oddsB, setOddsB] = useState(String(event.oddsB ?? "N/A"));
  const [maxBet, setMaxBet] = useState(String((event.maxBet / 100).toFixed(2)));
  const [bettingMinutes, setBettingMinutes] = useState("5");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setMsg("");
    try {
      const updated = await updateEvent(event.id, {
        oddsA: parseFloat(oddsA),
        oddsB: parseFloat(oddsB),
        maxBet: Math.round(parseFloat(maxBet) * 100),
      });
      onSaved(updated);
      setMsg("Saved");
      setTimeout(() => setMsg(""), 2000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setMsg(axiosErr.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenBetting = async () => {
    setSaving(true);
    setMsg("");
    try {
      const mins = parseInt(bettingMinutes, 10);
      if (isNaN(mins) || mins <= 0) {
        setMsg("Enter a valid number of minutes");
        return;
      }
      const updated = await updateEvent(event.id, { bettingOpenMinutes: mins });
      onSaved(updated);
      setMsg(`Betting open for ${mins} min`);
      setTimeout(() => setMsg(""), 3000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setMsg(axiosErr.response?.data?.message || "Failed to open betting");
    } finally {
      setSaving(false);
    }
  };

  const handleCloseBetting = async () => {
    setSaving(true);
    setMsg("");
    try {
      const updated = await updateEvent(event.id, { bettingOpenMinutes: 0 });
      onSaved(updated);
      setMsg("Betting closed");
      setTimeout(() => setMsg(""), 2000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setMsg(axiosErr.response?.data?.message || "Failed to close betting");
    } finally {
      setSaving(false);
    }
  };

  const isBettingOpen =
    event.bettingOpenUntil && new Date(event.bettingOpenUntil) > new Date();

  return (
    <div className="bg-gray-900 rounded-lg p-6 mb-4 border border-yellow-800/50">
      <h2 className="text-sm font-bold text-yellow-400 mb-3">Admin: Edit Odds</h2>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">
            Odds {event.teamA}
          </label>
          <input
            type="number"
            step="0.01"
            min="1.10"
            max="10.00"
            value={oddsA}
            onChange={(e) => setOddsA(e.target.value)}
            className="w-full bg-gray-800 text-white px-3 py-1.5 rounded border border-gray-700 focus:border-yellow-500 focus:outline-none font-mono text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">
            Odds {event.teamB}
          </label>
          <input
            type="number"
            step="0.01"
            min="1.10"
            max="10.00"
            value={oddsB}
            onChange={(e) => setOddsB(e.target.value)}
            className="w-full bg-gray-800 text-white px-3 py-1.5 rounded border border-gray-700 focus:border-yellow-500 focus:outline-none font-mono text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Max Bet (PB)</label>
          <input
            type="number"
            step="0.01"
            min="1"
            value={maxBet}
            onChange={(e) => setMaxBet(e.target.value)}
            className="w-full bg-gray-800 text-white px-3 py-1.5 rounded border border-gray-700 focus:border-yellow-500 focus:outline-none font-mono text-sm"
          />
        </div>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {msg && (
          <span
            className={`text-sm ${msg === "Saved" || msg.startsWith("Betting") ? "text-green-400" : "text-red-400"}`}
          >
            {msg}
          </span>
        )}
      </div>

      {event.status === "LIVE" && (
        <div className="border-t border-gray-700 pt-3">
          <h3 className="text-xs font-bold text-yellow-400 mb-2">
            Live Betting Control
          </h3>
          {isBettingOpen ? (
            <div className="flex items-center gap-3">
              <BettingCountdown until={event.bettingOpenUntil!} />
              <button
                onClick={handleCloseBetting}
                disabled={saving}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
              >
                Close Betting
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">Open for</label>
              <input
                type="number"
                min="1"
                max="120"
                value={bettingMinutes}
                onChange={(e) => setBettingMinutes(e.target.value)}
                className="w-16 bg-gray-800 text-white px-2 py-1.5 rounded border border-gray-700 focus:border-green-500 focus:outline-none font-mono text-sm text-center"
              />
              <label className="text-xs text-gray-400">min</label>
              <button
                onClick={handleOpenBetting}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
              >
                Open Betting
              </button>
            </div>
          )}
        </div>
      )}
    </div>
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
  // Twitch embeds need parent param
  if (url.includes("player.twitch.tv")) {
    const sep = url.includes("?") ? "&" : "?";
    url += `${sep}parent=${window.location.hostname}&autoplay=true&muted=false`;
  }
  // YouTube embeds need autoplay
  if (url.includes("youtube.com/embed")) {
    const sep = url.includes("?") ? "&" : "?";
    url += `${sep}autoplay=1`;
  }
  return url;
}

function StreamPlayer({ streams }: { streams: EventStream[] }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeStream, setActiveStream] = useState<EventStream | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (stream: EventStream) => {
    setActiveStream(stream);
    setIframeKey((k) => k + 1); // force fresh iframe
    setDropdownOpen(false);
  };

  const handleClose = () => {
    setActiveStream(null);
    setIframeKey((k) => k + 1); // ensure next open is a fresh load
  };

  const handlePiP = useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Try to get the video element from the iframe (same-origin only)
    // For cross-origin iframes, use documentPictureInPicture API
    try {
      if ("documentPictureInPicture" in window) {
        const pipWindow = await (
          window as any
        ).documentPictureInPicture.requestWindow({
          width: 640,
          height: 360,
        });
        const pipDoc = pipWindow.document;
        pipDoc.body.style.margin = "0";
        pipDoc.body.style.background = "#000";
        const pipIframe = pipDoc.createElement("iframe");
        pipIframe.src = buildEmbedUrl(activeStream!);
        pipIframe.style.width = "100%";
        pipIframe.style.height = "100%";
        pipIframe.style.border = "none";
        pipIframe.allow =
          "autoplay; encrypted-media; picture-in-picture; fullscreen";
        pipDoc.body.appendChild(pipIframe);
      }
    } catch {
      // Fallback: open stream in new window as mini player
      window.open(
        activeStream!.rawUrl,
        "_blank",
        "width=640,height=360,menubar=no,toolbar=no",
      );
    }
  }, [activeStream]);

  if (streams.length === 0) return null;

  return (
    <div className="bg-gray-900 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4 text-red-400"
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
          Watch Live
        </h3>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-2 border border-gray-700"
          >
            {activeStream
              ? getStreamLabel(activeStream)
              : "Select stream"}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
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

          {dropdownOpen && (
            <div className="absolute right-0 mt-1 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden">
              {streams.map((stream, i) => (
                <button
                  key={`${stream.embedUrl}-${i}`}
                  onClick={() => handleSelect(stream)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 flex items-center justify-between ${
                    activeStream?.embedUrl === stream.embedUrl
                      ? "bg-purple-900/30 text-purple-300"
                      : "text-gray-300"
                  }`}
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
      </div>

      {activeStream && (
        <div>
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              ref={iframeRef}
              key={iframeKey}
              src={buildEmbedUrl(activeStream)}
              className="absolute inset-0 w-full h-full rounded"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <a
              href={activeStream.rawUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 underline"
            >
              Open in new tab
            </a>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePiP}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded border border-gray-700"
                title="Picture-in-Picture"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-3.5 h-3.5 inline mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 6v12a2 2 0 002 2h4M4 6l0 0M14 14h4a2 2 0 012 2v2a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2a2 2 0 012-2z"
                  />
                </svg>
                PiP
              </button>
              <button
                onClick={handleClose}
                className="text-xs bg-red-900/50 hover:bg-red-900/70 text-red-300 px-2.5 py-1 rounded border border-red-800/50"
                title="Close player"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
    <span className="text-sm font-mono text-green-400">
      {remaining} left
    </span>
  );
}

function formatBalance(cents: number) {
  return (cents / 100).toFixed(2);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuthContext();
  const { settings } = useSettingsContext();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  // Bet slip state
  const [selection, setSelection] = useState<"a" | "b" | null>(null);
  const [amountStr, setAmountStr] = useState("");
  const [betError, setBetError] = useState("");
  const [betLoading, setBetLoading] = useState(false);
  const [betSuccess, setBetSuccess] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getEvent(id)
      .then(setEvent)
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleOddsUpdate = useCallback(
    (data: { eventId: string; oddsA: number; oddsB: number }) => {
      setEvent((prev) =>
        prev && prev.id === data.eventId
          ? { ...prev, oddsA: data.oddsA, oddsB: data.oddsB }
          : prev,
      );
    },
    [],
  );

  const handleStatusChange = useCallback(
    (data: { eventId: string; status: string }) => {
      setEvent((prev) =>
        prev && prev.id === data.eventId
          ? { ...prev, status: data.status as Event["status"] }
          : prev,
      );
    },
    [],
  );

  useOddsUpdates(handleOddsUpdate, handleStatusChange);

  const amountCents = Math.round(parseFloat(amountStr || "0") * 100);
  const selectedOdds =
    selection === "a" ? event?.oddsA : selection === "b" ? event?.oddsB : null;
  const potentialPayout =
    selectedOdds && amountCents > 0
      ? Math.floor(amountCents * selectedOdds)
      : 0;

  const handlePlaceBet = async () => {
    if (!selection || amountCents <= 0 || !event) return;
    setBetError("");
    setBetSuccess("");
    setBetLoading(true);

    try {
      const result = await placeBet({
        eventId: event.id,
        selection,
        amount: amountCents,
      });
      setBetSuccess(
        `Bet placed! Potential payout: ${formatBalance(result.potentialPayout)} PB`,
      );
      setTimeout(() => setBetSuccess(""), 4000);
      setSelection(null);
      setAmountStr("");
      await refreshUser();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const errMsg = axiosErr.response?.data?.message || "Failed to place bet";
      setBetError(errMsg);
      setTimeout(() => setBetError(""), 5000);
    } finally {
      setBetLoading(false);
    }
  };

  if (loading) {
    return <p className="text-gray-400">Loading event...</p>;
  }

  if (!event) {
    return <p className="text-gray-400">Event not found.</p>;
  }

  const isLiveBettingOpen =
    event.status === "LIVE" &&
    !!event.bettingOpenUntil &&
    new Date(event.bettingOpenUntil) > new Date();
  const hasRealOdds =
    event.game === "cs2"
      ? !!event.hltvId || settings.cs2AllowBetsWithoutHltv
      : true;
  const canBet =
    (event.status === "UPCOMING" || isLiveBettingOpen) &&
    event.oddsA &&
    event.oddsB &&
    hasRealOdds;

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => navigate("/")}
        className="text-gray-400 hover:text-white text-sm mb-4 inline-block"
      >
        &larr; Back to events
      </button>

      {isLiveBettingOpen && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-300 font-medium text-sm">
              Bets are OPEN
            </span>
          </div>
          <BettingCountdown until={event.bettingOpenUntil!} />
        </div>
      )}

      <div className="bg-gray-900 rounded-lg p-6 mb-4">
        <div className="flex items-center gap-2 mb-3">
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
            <span className="text-sm text-gray-400 font-medium">
              {event.league}
            </span>
          )}
          <span className="text-sm text-gray-500">{event.tournament}</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {event.teamALogo && (
              <img src={event.teamALogo} alt="" className="w-10 h-10 rounded" />
            )}
            <span className="text-xl font-bold">{event.teamA}</span>
          </div>
          {event.scoreA !== null && event.scoreB !== null ? (
            <div className="text-center">
              <div className="font-mono text-2xl font-bold">
                <span className={event.winnerId === "a" ? "text-green-400" : "text-gray-400"}>
                  {event.scoreA}
                </span>
                <span className="text-gray-600 mx-2">:</span>
                <span className={event.winnerId === "b" ? "text-green-400" : "text-gray-400"}>
                  {event.scoreB}
                </span>
              </div>
              {event.bestOf && (
                <div className="text-xs text-gray-500">BO{event.bestOf}</div>
              )}
            </div>
          ) : (
            <span className="text-gray-500 text-lg">vs</span>
          )}
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold">{event.teamB}</span>
            {event.teamBLogo && (
              <img src={event.teamBLogo} alt="" className="w-10 h-10 rounded" />
            )}
          </div>
        </div>

        <div className="text-sm text-gray-400 space-y-1">
          <p>Scheduled: {formatDate(event.scheduledAt)}</p>
          <p>
            Status: <span className="text-white">{event.status}</span>
          </p>
          <p>Max bet: {formatBalance(event.maxBet)} PB per user</p>
        </div>

        {event.status === "FINISHED" && event.winnerId && (
          <div className="mt-3 p-3 bg-green-900/20 rounded border border-green-800">
            Winner:{" "}
            <span className="font-bold text-green-400">
              {event.winnerId === "a" ? event.teamA : event.teamB}
            </span>
          </div>
        )}

        {event.status === "CANCELLED" && (
          <div className="mt-3 p-3 bg-yellow-900/20 rounded border border-yellow-800 text-yellow-400">
            This event was cancelled. All bets have been refunded.
          </div>
        )}
      </div>

      {event.streams.length > 0 && (
        <StreamPlayer streams={event.streams} />
      )}

      {user?.role === "ADMIN" && (
        <AdminOddsEditor
          event={event}
          onSaved={(updated) => setEvent(updated)}
        />
      )}

      {!hasRealOdds &&
        event.game === "cs2" &&
        event.status !== "FINISHED" &&
        event.status !== "CANCELLED" && (
          <div className="bg-gray-900 rounded-lg p-4 mb-4 text-sm text-gray-400">
            Odds pending — waiting for HLTV data.
          </div>
        )}

      {canBet && (
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-lg font-bold mb-4">Place a Bet</h2>

          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setSelection("a")}
              className={`flex-1 p-3 rounded border-2 transition ${
                selection === "a"
                  ? "border-purple-500 bg-purple-900/20"
                  : "border-gray-700 hover:border-gray-600"
              }`}
            >
              <div className="text-sm text-gray-400">{event.teamA}</div>
              <div className="font-mono text-lg text-purple-400">
                {event.oddsA?.toFixed(2)}
              </div>
            </button>
            <button
              onClick={() => setSelection("b")}
              className={`flex-1 p-3 rounded border-2 transition ${
                selection === "b"
                  ? "border-purple-500 bg-purple-900/20"
                  : "border-gray-700 hover:border-gray-600"
              }`}
            >
              <div className="text-sm text-gray-400">{event.teamB}</div>
              <div className="font-mono text-lg text-purple-400">
                {event.oddsB?.toFixed(2)}
              </div>
            </button>
          </div>

          {betSuccess && (
            <div className="bg-green-900/50 text-green-300 px-3 py-2 rounded text-sm mb-3">
              {betSuccess}
            </div>
          )}

          {betError && (
            <div className="bg-red-900/50 text-red-300 px-3 py-2 rounded text-sm mb-3">
              {betError}
            </div>
          )}

          {selection && (
            <>
              <div className="mb-4">
                <label className="text-sm text-gray-400 block mb-1">
                  Amount (PB)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={formatBalance(event.maxBet)}
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder={`Max: ${formatBalance(event.maxBet)} PB`}
                  className="w-full bg-gray-800 text-white px-4 py-2 rounded border border-gray-700 focus:border-purple-500 focus:outline-none font-mono"
                />
              </div>

              {potentialPayout > 0 && (
                <div className="mb-4 p-3 bg-gray-800 rounded">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Odds</span>
                    <span className="font-mono">
                      {selectedOdds?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Stake</span>
                    <span className="font-mono">
                      {formatBalance(amountCents)} PB
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold mt-1 pt-1 border-t border-gray-700">
                    <span className="text-gray-400">Potential payout</span>
                    <span className="font-mono text-green-400">
                      {formatBalance(potentialPayout)} PB
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={handlePlaceBet}
                disabled={betLoading || amountCents <= 0}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-medium disabled:opacity-50"
              >
                {betLoading
                  ? "Placing bet..."
                  : `Bet on ${selection === "a" ? event.teamA : event.teamB}`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
