import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getEvent } from "../api/events.api";
import { placeBet } from "../api/bets.api";
import { useAuthContext } from "../context/AuthContext";
import type { Event } from "../types";

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
  const { refreshUser } = useAuthContext();
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
      setSelection(null);
      setAmountStr("");
      await refreshUser();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setBetError(axiosErr.response?.data?.message || "Failed to place bet");
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

  const canBet = event.status === "UPCOMING" && event.oddsA && event.oddsB;

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => navigate("/")}
        className="text-gray-400 hover:text-white text-sm mb-4 inline-block"
      >
        &larr; Back to events
      </button>

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
          <span className="text-sm text-gray-500">{event.tournament}</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {event.teamALogo && (
              <img src={event.teamALogo} alt="" className="w-10 h-10 rounded" />
            )}
            <span className="text-xl font-bold">{event.teamA}</span>
          </div>
          <span className="text-gray-500 text-lg">vs</span>
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

              {betError && (
                <div className="bg-red-900/50 text-red-300 px-3 py-2 rounded text-sm mb-3">
                  {betError}
                </div>
              )}

              {betSuccess && (
                <div className="bg-green-900/50 text-green-300 px-3 py-2 rounded text-sm mb-3">
                  {betSuccess}
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
